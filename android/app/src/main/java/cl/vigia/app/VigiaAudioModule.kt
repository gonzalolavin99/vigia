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
import cl.vigia.app.boot.VigiaPrefs
import cl.vigia.app.reminders.Reminder
import cl.vigia.app.reminders.Reminders
import cl.vigia.app.reminders.Ringer
import cl.vigia.app.voice.Speaker
import cl.vigia.app.voice.Turn

class VigiaAudioModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  init { AudioEvents.context = context }
  override fun getName() = "VigiaAudio"

  @ReactMethod fun start(options: ReadableMap?, promise: Promise) {
    try {
      val diagnostic = options?.hasKey("diagnostic") == true && options.getBoolean("diagnostic")
      val saveAudio = options?.hasKey("saveAudio") == true && options.getBoolean("saveAudio")
      // Se recuerda para retomar la escucha con los mismos ajustes tras reiniciar el teléfono (ADR-003).
      VigiaPrefs.save(context, listening = true, diagnostic = diagnostic, saveAudio = saveAudio)
      ContextCompat.startForegroundService(context, VigiaPrefs.serviceIntent(context))
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("START_FAILED", error) }
  }

  @ReactMethod fun stop() {
    VigiaPrefs.save(context, listening = false, diagnostic = false, saveAudio = false)
    context.stopService(Intent(context, VoiceService::class.java))
  }
  // Efectos del orquestador de JS (src/orchestrator): hablar, mostrar, volver a escuchar y cerrar el turno.
  @ReactMethod fun speak(text: String, promise: Promise) {
    Speaker.init(context)
    Speaker.say(text) { ok -> if (ok) promise.resolve(true) else promise.reject("TTS_FAILED", "No se pudo hablar") }
  }

  @ReactMethod fun show(text: String) { ResponseActivity.show(context, text) }
  @ReactMethod fun listVoices(promise: Promise) {
    Speaker.init(context)
    val list = Arguments.createArray()
    Speaker.voices().forEach { (name, locale, network) ->
      list.pushMap(Arguments.createMap().apply { putString("name", name); putString("locale", locale); putBoolean("network", network) })
    }
    promise.resolve(Arguments.createMap().apply { putArray("voices", list); putString("current", Speaker.currentVoice()) })
  }
  @ReactMethod fun setVoice(name: String) { Speaker.setVoice(context, name) }

  // Recordatorios, alarmas y temporizadores (ADR-009), usados por src/native/reminderStore.ts.
  @ReactMethod fun remindersAdd(text: String, at: Double, kind: String, promise: Promise) {
    try { promise.resolve(toMap(Reminders.add(context, text, at.toLong(), kind))) } catch (e: Exception) { promise.reject("REMINDER_ADD", e) }
  }
  @ReactMethod fun remindersList(promise: Promise) {
    try {
      val list = Arguments.createArray()
      Reminders.list(context).forEach { list.pushMap(toMap(it)) }
      promise.resolve(list)
    } catch (e: Exception) { promise.reject("REMINDER_LIST", e) }
  }
  @ReactMethod fun remindersRemove(id: Double, promise: Promise) {
    try { Reminders.remove(context, id.toLong()); promise.resolve(true) } catch (e: Exception) { promise.reject("REMINDER_REMOVE", e) }
  }
  private fun toMap(r: Reminder) = Arguments.createMap().apply {
    putDouble("id", r.id.toDouble()); putString("text", r.text); putDouble("at", r.at.toDouble()); putString("kind", r.kind)
  }
  @ReactMethod fun stopAlarm() { Ringer.stop("button") }
  @ReactMethod fun listenAgain() { VoiceService.requestCommand() }
  @ReactMethod fun endTurn() { Turn.end(context) }

  // Tras reiniciar el teléfono el servicio arranca solo; la pantalla pregunta su estado al abrirse.
  @ReactMethod fun isRunning(promise: Promise) { promise.resolve(VoiceService.running) }
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
