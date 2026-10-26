package cl.vigia.app.music

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import cl.vigia.app.MetricsLog
import kotlin.concurrent.thread

// Diagnóstico de desarrollo (26 oct): qué pedido a la sesión de Apple Music reproduce la biblioteca de Gonzalo.
// Se dispara solo por ADB (permiso DUMP, que únicamente tiene el shell):
//   adb shell am broadcast -a cl.vigia.app.PROBE_MUSIC -n cl.vigia.app/.music.LibraryProbe --es query 'mi biblioteca'
//   adb shell am broadcast -a cl.vigia.app.PROBE_MUSIC -n cl.vigia.app/.music.LibraryProbe --es uri 'https://...'
// Registra el título, artista y nombre de la cola que quedaron sonando. (Navegar la biblioteca con MediaBrowser
// fue rechazado: probe_connection_failed.)
class LibraryProbe : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val app = context.applicationContext
    val query = intent.getStringExtra("query")
    val uri = intent.getStringExtra("uri")
    val pending = goAsync()
    thread(name = "VigiaProbe") {
      try {
        val controller = Music.controllerForProbe(app)
        if (controller == null) { MetricsLog.log(app, "probe_no_session"); return@thread }
        when {
          uri != null -> controller.transportControls.playFromUri(Uri.parse(uri), Bundle())
          query != null -> controller.transportControls.playFromSearch(query, Bundle())
        }
        SystemClock.sleep(7000)
        val meta = controller.metadata
        MetricsLog.log(app, "probe_result query=${query.orEmpty()} uri=${uri.orEmpty()} state=${controller.playbackState?.state} " +
          "title=${meta?.getString(MediaMetadata.METADATA_KEY_TITLE)} artist=${meta?.getString(MediaMetadata.METADATA_KEY_ARTIST)} " +
          "queue=${controller.queueTitle} queueSize=${controller.queue?.size}")
      } finally { pending.finish() }
    }
  }
}
