package cl.vigia.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import cl.vigia.app.reminders.Ringer
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

// Pantalla de respuesta sobre el bloqueo (ADR-012): enciende la pantalla, muestra el texto y se cierra sola.
// No desbloquea el teléfono. La vista es el componente React "VigiaResponse".
class ResponseActivity : ReactActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private val close = Runnable { finish() }

  override fun getMainComponentName(): String = "VigiaResponse"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = Bundle().apply {
        putString("text", intent.getStringExtra(EXTRA_TEXT).orEmpty())
        putBoolean("alarm", intent.getBooleanExtra(EXTRA_ALARM, false))
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    super.onCreate(null)
    current = java.lang.ref.WeakReference(this)
    handler.postDelayed(close, intent.getLongExtra(EXTRA_VISIBLE_MS, VISIBLE_MS))
  }

  override fun onDestroy() {
    handler.removeCallbacks(close)
    // Cerrar la pantalla de una alarma la detiene.
    if (intent.getBooleanExtra(EXTRA_ALARM, false)) Ringer.stop("screen_closed")
    super.onDestroy()
  }

  companion object {
    private const val EXTRA_TEXT = "text"
    private const val EXTRA_VISIBLE_MS = "visibleMs"
    private const val EXTRA_ALARM = "alarm"
    private var current: java.lang.ref.WeakReference<ResponseActivity>? = null

    /** Cierra la pantalla de respuesta si sigue abierta (por ejemplo, al detener una alarma con la voz). */
    fun dismiss() { current?.get()?.runOnUiThread { current?.get()?.finish() } }
    private const val VISIBLE_MS = 8000L

    // visibleMs: un recordatorio con alarma necesita la pantalla (y el proceso vivo) mientras suena y habla.
    fun show(context: Context, text: String, visibleMs: Long = VISIBLE_MS, alarm: Boolean = false) {
      // CLEAR_TOP reemplaza una respuesta anterior que siga en pantalla.
      context.startActivity(Intent(context, ResponseActivity::class.java)
        .putExtra(EXTRA_TEXT, text)
        .putExtra(EXTRA_VISIBLE_MS, visibleMs)
        .putExtra(EXTRA_ALARM, alarm)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION))
    }
  }
}
