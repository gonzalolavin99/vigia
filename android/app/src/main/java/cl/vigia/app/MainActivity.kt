package cl.vigia.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

// La pantalla principal (esfera de estado) se muestra sobre el bloqueo y enciende la pantalla al activarse
// Vigía o sonar una alarma (ADR-012, actualizado el 22 oct). No desbloquea el teléfono.
class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "Vigia"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    super.onCreate(savedInstanceState)
  }

  companion object {
    /** Trae la pantalla principal al frente (y enciende la pantalla) sin recrearla si ya está abierta. */
    fun bringToFront(context: Context) {
      context.startActivity(Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION))
    }
  }
}
