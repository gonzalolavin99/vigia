package cl.vigia.app.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// Voz de salida (fase 1): TTS nativo de Android en español; Piper queda para la fase 6 (docs/arquitectura.md).
object Speaker {
  private const val TAG = "VigiaMetrics"
  private var tts: TextToSpeech? = null
  @Volatile private var ready = false
  private val pending = ConcurrentHashMap<String, (Boolean) -> Unit>()
  private val queued = mutableListOf<Pair<String, (Boolean) -> Unit>>()

  /** Mientras habla, el servicio no escucha: evita que Vigía se active con su propia voz. */
  @Volatile var speaking = false
    private set

  fun init(context: Context) {
    if (tts != null) return
    val app = context.applicationContext
    tts = TextToSpeech(app) { status ->
      val engine = tts ?: return@TextToSpeech
      if (status != TextToSpeech.SUCCESS) { Log.e(TAG, "tts_init_failed status=$status"); return@TextToSpeech }
      // Español de Chile si el motor lo tiene; si no, español genérico.
      val locale = listOf(Locale("es", "CL"), Locale("es", "US"), Locale("es", "ES"), Locale("es"))
        .firstOrNull { engine.isLanguageAvailable(it) >= TextToSpeech.LANG_AVAILABLE } ?: Locale("es")
      engine.language = locale
      // Voz elegida en la app (Android no informa el género de las voces; se elige escuchándolas).
      prefs(app).getString("voice", null)?.let { name -> engine.voices?.firstOrNull { it.name == name }?.let { engine.voice = it } }
      engine.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(id: String) {}
        override fun onDone(id: String) = complete(id, true)
        @Deprecated("Deprecated in Java") override fun onError(id: String) = complete(id, false)
        override fun onError(id: String, code: Int) = complete(id, false)
      })
      ready = true
      Log.i(TAG, "t=${System.currentTimeMillis()} tts_ready locale=$locale voice=${engine.voice?.name}")
      synchronized(queued) { queued.forEach { (text, done) -> say(text, done) }; queued.clear() }
    }
  }

  /** Voces en español instaladas: nombre, idioma y si requieren internet. */
  fun voices(): List<Triple<String, String, Boolean>> =
    tts?.voices.orEmpty()
      .filter { it.locale.language == "es" }
      .sortedWith(compareBy({ it.isNetworkConnectionRequired }, { it.locale.toString() }, { it.name }))
      .map { Triple(it.name, it.locale.toString(), it.isNetworkConnectionRequired) }

  fun currentVoice(): String? = tts?.voice?.name

  fun setVoice(context: Context, name: String) {
    val engine = tts ?: return
    engine.voices?.firstOrNull { it.name == name }?.let {
      engine.voice = it
      prefs(context).edit().putString("voice", name).apply()
    }
  }

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("vigia", Context.MODE_PRIVATE)

  /** Habla [text] y llama a [done] al terminar (true) o al fallar (false). */
  fun say(text: String, done: (Boolean) -> Unit) {
    val engine = tts
    if (engine == null || !ready) { synchronized(queued) { queued.add(text to done) }; return }
    val id = UUID.randomUUID().toString()
    speaking = true
    pending[id] = done
    Log.i(TAG, "t=${System.currentTimeMillis()} speak_start chars=${text.length}")
    if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) complete(id, false)
  }

  private fun complete(id: String, ok: Boolean) {
    speaking = false
    Log.i(TAG, "t=${System.currentTimeMillis()} speak_end ok=$ok")
    pending.remove(id)?.invoke(ok)
  }
}

// Al detectar "Alfred": tono corto y foco de audio transitorio, que baja (o pausa) la música del Echo.
object Turn {
  // begin() llega desde el hilo de audio y end() desde JS.
  private var focus: AudioFocusRequest? = null
  private var tone: ToneGenerator? = null

  @Synchronized fun begin(context: Context) {
    // La esfera en "Te escucho…" aparece sobre el bloqueo apenas se dice "Alfred".
    cl.vigia.app.MainActivity.bringToFront(context)
    val audio = context.getSystemService(AudioManager::class.java)
    if (focus == null && Build.VERSION.SDK_INT >= 26) {
      focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .build()
        .also { audio.requestAudioFocus(it) }
    }
    if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, 60)
    tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
  }

  /** Devuelve el foco: la música vuelve a su volumen. */
  @Synchronized fun end(context: Context) {
    val request = focus ?: return
    if (Build.VERSION.SDK_INT >= 26) context.getSystemService(AudioManager::class.java).abandonAudioFocusRequest(request)
    focus = null
  }
}
