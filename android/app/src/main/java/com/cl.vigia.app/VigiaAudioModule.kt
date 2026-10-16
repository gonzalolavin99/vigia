package cl.vigia.app

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import cl.vigia.app.audio.VoiceService

class VigiaAudioModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  init { AudioEvents.context = context }
  override fun getName() = "VigiaAudio"

  @ReactMethod fun start(promise: Promise) {
    try {
      ContextCompat.startForegroundService(context, Intent(context, VoiceService::class.java))
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("START_FAILED", error) }
  }

  @ReactMethod fun stop() { context.stopService(Intent(context, VoiceService::class.java)) }
  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit
}

object AudioEvents {
  @Volatile var context: ReactApplicationContext? = null
  fun send(type: String, text: String? = null, elapsedMs: Long? = null, count: Int? = null, message: String? = null) {
    val payload = com.facebook.react.bridge.Arguments.createMap().apply {
      putString("type", type)
      text?.let { putString("text", it) }
      elapsedMs?.let { putDouble("elapsedMs", it.toDouble()) }
      count?.let { putInt("count", it) }
      message?.let { putString("message", it) }
    }
    context?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("VigiaAudioEvent", payload)
  }
}
