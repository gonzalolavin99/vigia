package cl.vigia.app.reminders

import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import cl.vigia.app.AudioEvents

// Tono de alarma y temporizador que se puede detener con la voz (fase 2, 21 oct): suena a pulsos (2 s sí, 1,5 s no)
// para que en los silencios el micrófono distinga "Alfred, para"; VoiceService llama a stop() al oírlo.
// También se detiene con el botón de la pantalla o solo, a los 2 minutos.
object Ringer {
  private const val TAG = "VigiaMetrics"
  private const val ON_MS = 2000L
  private const val OFF_MS = 1500L
  private const val MAX_MS = 120_000L

  private val handler = Handler(Looper.getMainLooper())
  private var tone: Ringtone? = null
  private var startedAt = 0L
  private var onStopped: (() -> Unit)? = null

  /** true mientras la alarma está sonando (incluidos los silencios entre pulsos). */
  @Volatile var ringing = false
    private set

  fun start(context: Context, onStopped: () -> Unit) {
    handler.post {
      stopNow(notify = false)
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      tone = RingtoneManager.getRingtone(context.applicationContext, uri)?.apply {
        audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
      }
      this.onStopped = onStopped
      startedAt = System.currentTimeMillis()
      ringing = true
      AudioEvents.send("ringing", "message" to "Alarma sonando")
      pulse()
    }
  }

  /** Detiene la alarma; seguro de llamar desde cualquier hilo y aunque no esté sonando. */
  fun stop(reason: String) {
    if (!ringing) return
    Log.i(TAG, "t=${System.currentTimeMillis()} ring_stop reason=$reason afterMs=${System.currentTimeMillis() - startedAt}")
    handler.post { stopNow(notify = true) }
  }

  private val nextPulse = Runnable { pulse() }

  private fun pulse() {
    if (!ringing) return
    if (System.currentTimeMillis() - startedAt > MAX_MS) { stop("timeout"); return }
    tone?.play()
    handler.postDelayed({ tone?.stop() }, ON_MS)
    handler.postDelayed(nextPulse, ON_MS + OFF_MS)
  }

  private fun stopNow(notify: Boolean) {
    val wasRinging = ringing
    ringing = false
    handler.removeCallbacksAndMessages(null)
    tone?.stop()
    tone = null
    if (notify && wasRinging) {
      AudioEvents.send("ring_stopped")
      onStopped?.invoke()
    }
    onStopped = null
  }
}
