package cl.vigia.app.music

import android.content.ComponentName
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.provider.MediaStore
import android.os.SystemClock
import android.service.notification.NotificationListenerService
import android.util.Log
import android.view.KeyEvent
import cl.vigia.app.MetricsLog
import androidx.core.app.NotificationManagerCompat

// Música (fase 3, ADR-008): Apple Music se controla por su sesión multimedia, igual que Android Auto o un reloj.
// Encontrar esa sesión exige "Acceso a notificaciones"; Gonzalo lo autorizó el 22 oct solo para esto.
// MediaListener no lee ni guarda notificaciones: existe porque Android lo pide para entregar las sesiones.
class MediaListener : NotificationListenerService()

object Music {
  private const val TAG = "VigiaMetrics"
  const val APPLE_MUSIC = "com.apple.android.music"
  private const val VOLUME_STEP = 10

  fun hasAccess(context: Context) = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

  private fun session(context: Context): MediaController? {
    if (!hasAccess(context)) return null
    val manager = context.getSystemService(MediaSessionManager::class.java)
    return manager.getActiveSessions(ComponentName(context, MediaListener::class.java)).firstOrNull { it.packageName == APPLE_MUSIC }
  }

  // Si Apple Music no está abierta no hay sesión: se abre en segundo plano y se espera hasta 6 s.
  private fun sessionOrLaunch(context: Context): MediaController? {
    session(context)?.let { return it }
    if (!hasAccess(context)) return null
    context.packageManager.getLaunchIntentForPackage(APPLE_MUSIC)?.let {
      it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_NO_ANIMATION)
      context.startActivity(it)
    }
    val until = SystemClock.elapsedRealtime() + 6000
    while (SystemClock.elapsedRealtime() < until) {
      session(context)?.let { return it }
      SystemClock.sleep(300)
    }
    return null
  }

  /** Con query busca y reproduce; sin query reanuda. Espera hasta 8 s a que suene. Bloquea: llamar fuera del hilo principal. */
  fun play(context: Context, query: String?, focus: String? = null, artist: String? = null): Boolean {
    val controller = sessionOrLaunch(context) ?: return mediaKey(context, KeyEvent.KEYCODE_MEDIA_PLAY).let { false }
    // Si ya sonaba algo, se espera a que cambie la canción para no anunciar la anterior.
    val before = if (query.isNullOrBlank()) null else controller.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
    if (query.isNullOrBlank()) controller.transportControls.play()
    else controller.transportControls.playFromSearch(listOfNotNull(query, artist).joinToString(" "), searchExtras(query, focus, artist))
    val until = SystemClock.elapsedRealtime() + 8000
    // Sin nada en cola (Apple Music recién abierta tras días sin uso), "reanudar" no hace nada: a los 3 s se pide
    // una búsqueda vacía, que en Android significa "pon algo" (26 oct).
    var fallbackAt = if (query.isNullOrBlank()) SystemClock.elapsedRealtime() + 3000 else Long.MAX_VALUE
    while (SystemClock.elapsedRealtime() < until) {
      if (SystemClock.elapsedRealtime() > fallbackAt && controller.playbackState?.state != PlaybackState.STATE_PLAYING) {
        controller.transportControls.playFromSearch("", Bundle())
        fallbackAt = Long.MAX_VALUE
        MetricsLog.log(context, "music_resume_fallback")
      }
      val changed = before == null || controller.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) != before
      if (controller.playbackState?.state == PlaybackState.STATE_PLAYING && changed) {
        SystemClock.sleep(600) // los metadatos llegan un poco después del estado PLAYING
        MetricsLog.log(context, "music_play query=${query.orEmpty()} focus=${focus.orEmpty()} artist=${artist.orEmpty()} title=${nowPlaying(context)?.first}")
        return true
      }
      SystemClock.sleep(250)
    }
    MetricsLog.log(context, "music_play_failed query=${query.orEmpty()} state=${controller.playbackState?.state}")
    return false
  }

  // Los mismos datos que entrega Google Assistant: le dicen a Apple Music si se pide un artista, una canción o un álbum.
  private fun searchExtras(query: String, focus: String?, artist: String?) = Bundle().apply {
    when (focus) {
      "artist" -> { putString(MediaStore.EXTRA_MEDIA_FOCUS, MediaStore.Audio.Artists.ENTRY_CONTENT_TYPE); putString(MediaStore.EXTRA_MEDIA_ARTIST, query) }
      "album" -> { putString(MediaStore.EXTRA_MEDIA_FOCUS, MediaStore.Audio.Albums.ENTRY_CONTENT_TYPE); putString(MediaStore.EXTRA_MEDIA_ALBUM, query) }
      "song" -> {
        putString(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/audio")
        putString(MediaStore.EXTRA_MEDIA_TITLE, query)
        artist?.let { putString(MediaStore.EXTRA_MEDIA_ARTIST, it) }
      }
    }
  }

  fun pause(context: Context) { session(context)?.transportControls?.pause() ?: mediaKey(context, KeyEvent.KEYCODE_MEDIA_PAUSE) }
  fun next(context: Context) { session(context)?.transportControls?.skipToNext() ?: mediaKey(context, KeyEvent.KEYCODE_MEDIA_NEXT) }
  fun previous(context: Context) { session(context)?.transportControls?.skipToPrevious() ?: mediaKey(context, KeyEvent.KEYCODE_MEDIA_PREVIOUS) }

  /** Título y artista de lo que suena en Apple Music, o null si no suena nada. */
  fun nowPlaying(context: Context): Pair<String, String>? {
    val controller = session(context) ?: return null
    if (controller.playbackState?.state != PlaybackState.STATE_PLAYING) return null
    val meta = controller.metadata ?: return null
    val title = meta.getString(MediaMetadata.METADATA_KEY_TITLE) ?: return null
    return title to (meta.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: "artista desconocido")
  }

  /** Cambia el volumen de la música (se refleja en el Echo por Bluetooth) y devuelve el resultado en %. */
  fun volume(context: Context, byPercent: Int?, toPercent: Int?): Int {
    val audio = context.getSystemService(AudioManager::class.java)
    val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    val current = audio.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max
    val target = (toPercent ?: (current + (byPercent ?: 0))).coerceIn(0, 100)
    audio.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(target * max / 100f), 0)
    return audio.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max
  }

  fun volumeStep() = VOLUME_STEP

  /** Nombre del parlante Bluetooth (A2DP) conectado, o null si la música sale por el teléfono. */
  fun speaker(context: Context): String? =
    context.getSystemService(AudioManager::class.java).getDevices(AudioManager.GET_DEVICES_OUTPUTS)
      .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }?.productName?.toString()

  // Sin acceso a la sesión: teclas multimedia, como los botones de unos audífonos.
  private fun mediaKey(context: Context, code: Int) {
    val audio = context.getSystemService(AudioManager::class.java)
    audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
    audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
  }
}
