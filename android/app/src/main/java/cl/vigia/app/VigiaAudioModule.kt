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
import cl.vigia.app.music.Music
import cl.vigia.app.net.Net
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

  // La respuesta se ve en la pantalla principal; aquí solo se trae al frente y se enciende la pantalla.
  @ReactMethod fun show(text: String) { MainActivity.bringToFront(context) }
  // Estado de una alarma al abrir la pantalla (pudo empezar a sonar antes de que cargara la interfaz).
  @ReactMethod fun ringStatus(promise: Promise) {
    promise.resolve(Arguments.createMap().apply { putBoolean("ringing", Ringer.ringing); putString("message", Reminders.lastAnnouncement) })
  }
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
  // Música (fase 3, ADR-008). play puede tardar (abrir Apple Music, esperar que suene): va en un hilo aparte.
  @ReactMethod fun musicPlay(query: String?, focus: String?, artist: String?, promise: Promise) {
    kotlin.concurrent.thread(name = "VigiaMusic") {
      try {
        val ok = Music.play(context, query, focus, artist)
        // Si hubo que abrir Apple Music, la esfera vuelve al frente.
        MainActivity.bringToFront(context)
        promise.resolve(ok)
      } catch (e: Exception) { promise.reject("MUSIC_PLAY", e) }
    }
  }
  @ReactMethod fun musicPause(promise: Promise) { Music.pause(context); promise.resolve(true) }
  @ReactMethod fun musicNext(promise: Promise) { Music.next(context); promise.resolve(true) }
  @ReactMethod fun musicPrevious(promise: Promise) { Music.previous(context); promise.resolve(true) }
  /** change: {by: "up"|"down"} o {percent: n}. */
  @ReactMethod fun musicVolume(change: ReadableMap, promise: Promise) {
    val by = if (change.hasKey("by")) (if (change.getString("by") == "up") Music.volumeStep() else -Music.volumeStep()) else null
    val to = if (change.hasKey("percent")) change.getDouble("percent").toInt() else null
    promise.resolve(Music.volume(context, by, to))
  }
  @ReactMethod fun musicNowPlaying(promise: Promise) {
    val song = Music.nowPlaying(context)
    promise.resolve(song?.let { (title, artist) -> Arguments.createMap().apply { putString("title", title); putString("artist", artist) } })
  }
  @ReactMethod fun musicSpeaker(promise: Promise) { promise.resolve(Music.speaker(context)) }
  @ReactMethod fun musicAccess(promise: Promise) { promise.resolve(Music.hasAccess(context)) }
  /** Abre Ajustes en "Acceso a notificaciones" para que Gonzalo active Vigía. */
  @ReactMethod fun openNotificationAccess() {
    context.startActivity(android.content.Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  // Red para los adaptadores de dispositivos en TypeScript (ADR-020). Todo en un hilo aparte: puede esperar respuestas.
  private fun background(promise: Promise, code: String, block: () -> Any?) {
    kotlin.concurrent.thread(name = "VigiaNet") {
      try { promise.resolve(block()) } catch (e: Exception) { promise.reject(code, e.message ?: e.javaClass.simpleName, e) }
    }
  }
  @ReactMethod fun netUdp(host: String, port: Double, payload: String, waitMs: Double, promise: Promise) = background(promise, "NET_UDP") {
    Arguments.createArray().apply {
      Net.udp(host, port.toInt(), payload, waitMs.toInt()).forEach { r -> pushMap(Arguments.createMap().apply { putString("from", r.from); putString("payload", r.payload) }) }
    }
  }
  @ReactMethod fun netWakeOnLan(mac: String, promise: Promise) = background(promise, "NET_WOL") { Net.wakeOnLan(mac); true }
  @ReactMethod fun netWs(url: String, messages: com.facebook.react.bridge.ReadableArray, waitMs: Double, insecureLocal: Boolean, promise: Promise) = background(promise, "NET_WS") {
    val list = (0 until messages.size()).map { messages.getString(it) ?: "" }
    Arguments.createArray().apply { Net.wsExchange(url, list, waitMs.toLong(), insecureLocal).forEach { pushString(it) } }
  }
  @ReactMethod fun netHttpGet(url: String, waitMs: Double, insecureLocal: Boolean, promise: Promise) = background(promise, "NET_HTTP") { Net.httpGet(url, waitMs.toLong(), insecureLocal) }
  @ReactMethod fun netHttpPost(url: String, json: String, headers: ReadableMap, connectMs: Double, totalMs: Double, promise: Promise) = background(promise, "NET_POST") {
    val map = headers.toHashMap().mapValues { it.value.toString() }
    Net.httpPost(url, json, map, connectMs.toLong(), totalMs.toLong())?.let { (code, body) ->
      Arguments.createMap().apply { putInt("status", code); putString("body", body) }
    }
  }
  @ReactMethod fun readConfig(promise: Promise) = background(promise, "CONFIG") { Net.readConfig(context) }
  // Valores pequeños que TS necesita guardar (por ejemplo, el token de la TV).
  @ReactMethod fun kvGet(key: String, promise: Promise) { promise.resolve(context.getSharedPreferences("vigia-kv", 0).getString(key, null)) }
  @ReactMethod fun kvSet(key: String, value: String) { context.getSharedPreferences("vigia-kv", 0).edit().putString(key, value).apply() }

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
