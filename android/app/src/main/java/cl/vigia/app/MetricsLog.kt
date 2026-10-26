package cl.vigia.app

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Registro de eventos en logcat (VigiaMetrics) y en files/logs/vigia-AAAAMMDD.log, que sobrevive a reinicios
// y se copia al PC con `npm run logs`.
object MetricsLog {
  private const val TAG = "VigiaMetrics"
  private val lock = Any()

  fun log(context: Context, event: String) {
    val line = "t=${System.currentTimeMillis()} $event"
    Log.i(TAG, line)
    try {
      val dir = File(context.getExternalFilesDir(null), "logs").apply { mkdirs() }
      val day = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
      synchronized(lock) { File(dir, "vigia-$day.log").appendText(line + "\n") }
    } catch (_: Exception) { }
  }
}
