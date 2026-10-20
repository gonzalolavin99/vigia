package cl.vigia.app

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import cl.vigia.app.audio.VoiceService

class VigiaAudioModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  init { AudioEvents.context = context }
  override fun getName() = "VigiaAudio"

  @ReactMethod fun start(options: ReadableMap?, promise: Promise) {
    try {
      val intent = Intent(context, VoiceService::class.java)
        .putExtra(VoiceService.EXTRA_DIAGNOSTIC, options?.hasKey("diagnostic") == true && options.getBoolean("diagnostic"))
        .putExtra(VoiceService.EXTRA_SAVE_AUDIO, options?.hasKey("saveAudio") == true && options.getBoolean("saveAudio"))
      ContextCompat.startForegroundService(context, intent)
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("START_FAILED", error) }
  }

  @ReactMethod fun stop() { context.stopService(Intent(context, VoiceService::class.java)) }
  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit
}

object AudioEvents {
  @Volatile var context: ReactApplicationContext? = null
  fun send(type: String, vararg fields: Pair<String, Any?>) {
    val payload = Arguments.createMap().apply {
      putString("type", type)
      for ((key, value) in fields) when (value) {
        is String -> putString(key, value)
        is Boolean -> putBoolean(key, value)
        is Int -> putInt(key, value)
        is Long -> putDouble(key, value.toDouble())
        is Double -> putDouble(key, value)
        null -> putNull(key)
        else -> putString(key, value.toString())
      }
    }
    context?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("VigiaAudioEvent", payload)
  }
}
