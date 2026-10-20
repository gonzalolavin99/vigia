package cl.vigia.app.boot

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.core.content.ContextCompat
import cl.vigia.app.audio.VoiceService

// Arranque al encender (ADR-003). En Android 11 un servicio de micrófono iniciado desde segundo plano
// graba silencio; por eso el receptor abre una actividad transparente sobre el bloqueo, que inicia el
// servicio en primer plano y se cierra. Abrir esa actividad requiere SYSTEM_ALERT_WINDOW, concedido por ADB.
object VigiaPrefs {
  private const val NAME = "vigia"
  fun save(context: Context, listening: Boolean, diagnostic: Boolean, saveAudio: Boolean) {
    context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit()
      .putBoolean("listening", listening).putBoolean("diagnostic", diagnostic).putBoolean("saveAudio", saveAudio).apply()
  }
  fun listening(context: Context) = context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getBoolean("listening", false)
  fun serviceIntent(context: Context): Intent {
    val prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
    return Intent(context, VoiceService::class.java)
      .putExtra(VoiceService.EXTRA_DIAGNOSTIC, prefs.getBoolean("diagnostic", false))
      .putExtra(VoiceService.EXTRA_SAVE_AUDIO, prefs.getBoolean("saveAudio", false))
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    // Solo si la escucha estaba activa cuando se apagó: "Detener escucha" desactiva el arranque.
    if (!VigiaPrefs.listening(context)) return
    Log.i(TAG, "t=${System.currentTimeMillis()} boot_completed starting")
    context.startActivity(Intent(context, BootActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}

class BootActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Visible sobre la pantalla de bloqueo: si quedara detrás, Android no la cuenta como primer plano.
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    ContextCompat.startForegroundService(this, VigiaPrefs.serviceIntent(this))
    Log.i(TAG, "t=${System.currentTimeMillis()} boot_service_started")
    finish()
  }
}

private const val TAG = "VigiaMetrics"
