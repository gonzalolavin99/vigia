package cl.vigia.app.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import cl.vigia.app.AudioEvents
import cl.vigia.app.R
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineNemoEncDecCtcModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

// Activación híbrida (ADR-018): detector de palabra clave o "Alfred" en la transcripción NeMo (ADR-019).
class VoiceService : Service() {
  @Volatile private var active = false
  private var recorder: AudioRecord? = null
  private var audioThread: Thread? = null
  private var wakeLock: PowerManager.WakeLock? = null
  // Decodificación y escritura de audio fuera del hilo de captura: el micrófono nunca se pausa.
  private var worker: ExecutorService? = null
  private var nemo: OfflineRecognizer? = null
  private var diagnostic = false
  private var saveAudio = false
  private var evalDir: File? = null

  // Activaciones por texto que el worker encontró; el hilo de audio las atiende en su ciclo.
  private data class TextWake(val fromSample: Long)
  private val textWakes = ConcurrentLinkedQueue<TextWake>()
  // Últimos 3 s de audio, para no perder el inicio del comando tras una activación por texto.
  private val ring = FloatArray(SAMPLE_RATE * 3)
  private var totalSamples = 0L

  private val wakeCount = java.util.concurrent.atomic.AtomicInteger()
  // Muestra en que hubo la última activación; evita que el mismo "Alfred" active dos veces (detector y texto).
  @Volatile private var lastWakeSample = Long.MIN_VALUE / 2
  // Momento de la última activación; 0 = esperando la palabra de activación.
  private var commandStartedAt = 0L
  private var commandSpeechSeen = false
  private var lastSpeechAt = 0L
  private val command = mutableListOf<FloatArray>()
  private var lastBeatAt = 0L
  private var levelSum = 0.0
  private var levelCount = 0

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Vigía escucha", NotificationManager.IMPORTANCE_LOW))
    val notification: Notification = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL)
      .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Vigía está escuchando").setContentText("Audio procesado en este teléfono").setOngoing(true).build()
    else @Suppress("DEPRECATION") Notification.Builder(this).setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Vigía está escuchando").setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    else startForeground(NOTIFICATION_ID, notification)
    // Con la pantalla apagada la CPU puede dormirse y frenar el procesamiento (criterio de fase 0).
    wakeLock = getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Vigia:audio")
      .apply { setReferenceCounted(false); acquire() }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!active) {
      diagnostic = intent?.getBooleanExtra(EXTRA_DIAGNOSTIC, false) ?: false
      saveAudio = intent?.getBooleanExtra(EXTRA_SAVE_AUDIO, false) ?: false
      startAudioLoop()
    }
    return START_NOT_STICKY
  }

  private fun startAudioLoop() {
    active = true
    running = true
    worker = Executors.newSingleThreadExecutor()
    audioThread = thread(name = "VigiaAudio") {
      var spotter: KeywordSpotter? = null
      var wakeStream: com.k2fsa.sherpa.onnx.OnlineStream? = null
      var vad: Vad? = null
      var listenVad: Vad? = null
      try {
        val root = ensureModels()
        val kws = File(root, "kws")
        spotter = KeywordSpotter(config = KeywordSpotterConfig(
          featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
          modelConfig = OnlineModelConfig(transducer = OnlineTransducerModelConfig(encoder = File(kws, KWS_ENCODER).path, decoder = File(kws, KWS_DECODER).path, joiner = File(kws, KWS_JOINER).path), tokens = File(kws, "tokens.txt").path, numThreads = 2, provider = "cpu", modelingUnit = "bpe", bpeVocab = File(kws, "bpe.model").path),
          keywordsFile = File(kws, "keywords.txt").path, keywordsScore = 1.5f, keywordsThreshold = KWS_THRESHOLD))
        wakeStream = spotter.createStream()
        vad = newVad(File(root, "silero_vad.onnx"))
        commandVad = vad
        listenVad = newVad(File(root, "silero_vad.onnx"))
        nemo = OfflineRecognizer(config = OfflineRecognizerConfig(featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80), modelConfig = OfflineModelConfig(nemo = OfflineNemoEncDecCtcModelConfig(model = File(root, "nemo-es/model.int8.onnx").path), tokens = File(root, "nemo-es/tokens.txt").path, numThreads = 2, provider = "cpu")))
        if (saveAudio) evalDir = File(getExternalFilesDir(null), "eval").apply { mkdirs() }

        val minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        // 2 s de colchón: un tropiezo del hilo no pierde audio.
        recorder = AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, SAMPLE_RATE * 2 * 2))
        check(recorder?.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord no se pudo inicializar" }
        recorder?.startRecording()
        log("listening diagnostic=$diagnostic saveAudio=$saveAudio")
        AudioEvents.send("status", "message" to "Escuchando palabra de activación")
        val shortBuffer = ShortArray(512)
        while (active) {
          val count = recorder?.read(shortBuffer, 0, shortBuffer.size) ?: -1
          if (count <= 0) continue
          val samples = FloatArray(count) { shortBuffer[it] / 32768.0f }
          remember(samples)
          val now = SystemClock.elapsedRealtime()
          if (commandStartedAt == 0L) {
            listenVad?.let { listen(it, samples, kwsHit = false) }
            wakeStream?.acceptWaveform(samples, SAMPLE_RATE)
            while (spotter?.isReady(wakeStream!!) == true) {
              spotter?.decode(wakeStream!!)
              val keyword = spotter?.getResult(wakeStream!!)?.keyword.orEmpty()
              if (keyword.isNotBlank()) {
                spotter?.reset(wakeStream!!)
                // El tramo con la palabra se cierra aquí: no debe volver a activar por texto.
                listenVad?.let { it.flush(); drain(it, kwsHit = true); it.reset() }
                startCommand(now, source = "kws", label = keyword, prefill = null)
              }
            }
            textWakes.poll()?.let { wake ->
              textWakes.clear()
              spotter?.reset(wakeStream!!)
              listenVad?.reset()
              // El usuario pudo empezar el comando mientras se decodificaba: se recupera desde el fin del tramo.
              startCommand(now, source = "text", label = "ALFRED", prefill = since(wake.fromSample))
            }
          } else {
            val detector = vad ?: continue
            // Los primeros ms tras la activación traen la cola de "Alfred"; se descartan.
            if (now - commandStartedAt < SKIP_AFTER_WAKE_MS) continue
            // Se guarda todo el audio desde aquí: el VAD solo decide cuándo terminó el comando,
            // así no se corta la primera palabra.
            command.add(samples)
            detector.acceptWaveform(samples)
            while (!detector.empty()) { detector.pop(); commandSpeechSeen = true; lastSpeechAt = now }
            if (detector.isSpeechDetected()) { commandSpeechSeen = true; lastSpeechAt = now }
            val captured = command.sumOf { it.size }
            val ended = commandSpeechSeen && now - lastSpeechAt > COMMAND_END_SILENCE_MS
            if (ended || captured >= SAMPLE_RATE * MAX_COMMAND_S) {
              val audio = concat(command)
              command.clear()
              backToWake()
              detector.reset()
              transcribeCommand(audio)
              AudioEvents.send("status", "message" to "Escuchando palabra de activación")
            } else if (!commandSpeechSeen && now - commandStartedAt > COMMAND_TIMEOUT_MS) {
              // Activación sin comando (o falsa): volver a escuchar la palabra en vez de quedar esperando.
              command.clear()
              backToWake()
              detector.reset()
              log("command_timeout")
              AudioEvents.send("status", "message" to "Sin comando; escuchando palabra de activación")
            }
          }
          heartbeat(samples)
        }
      } catch (error: Exception) {
        Log.e(TAG, "audio loop failed", error)
        AudioEvents.send("error", "message" to (error.message ?: error.javaClass.simpleName))
        stopSelf()
      } finally {
        active = false
        running = false
        try { recorder?.stop() } catch (_: Exception) { }
        recorder?.release(); recorder = null
        wakeStream?.release(); spotter?.release(); vad?.release(); listenVad?.release()
        // Espera a que terminen las transcripciones pendientes antes de liberar los modelos.
        worker?.shutdown()
        try { worker?.awaitTermination(5, TimeUnit.SECONDS) } catch (_: InterruptedException) { worker?.shutdownNow() }
        nemo?.release(); nemo = null
        commandVad = null
      }
    }
  }

  private fun startCommand(now: Long, source: String, label: String, prefill: FloatArray?) {
    commandVad?.reset()
    command.clear()
    commandSpeechSeen = false
    textWakes.clear()
    lastWakeSample = totalSamples
    val n = wakeCount.incrementAndGet()
    if (prefill != null && prefill.isNotEmpty()) {
      // Sin descarte inicial: el audio previo ya es posterior a "Alfred".
      commandStartedAt = now - SKIP_AFTER_WAKE_MS
      command.add(prefill)
      commandVad?.acceptWaveform(prefill)
    } else {
      commandStartedAt = now
    }
    log("wake source=$source keyword=$label count=$n")
    AudioEvents.send("wake", "text" to label, "source" to source, "count" to n)
    AudioEvents.send("status", "message" to "Activación ($source). Di tu comando.")
  }

  // VAD que cierra el comando; campo para que startCommand pueda prellenarlo.
  private var commandVad: Vad? = null

  private fun newVad(model: File) = Vad(config = VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(model = model.path, threshold = 0.5f, minSilenceDuration = 0.4f, minSpeechDuration = 0.25f, windowSize = 512, maxSpeechDuration = 8.0f), sampleRate = SAMPLE_RATE, numThreads = 1, provider = "cpu"))

  private fun backToWake() { commandStartedAt = 0L }

  private fun remember(samples: FloatArray) {
    for (s in samples) { ring[(totalSamples % ring.size).toInt()] = s; totalSamples++ }
  }

  private fun since(fromSample: Long): FloatArray {
    val start = maxOf(fromSample, totalSamples - ring.size)
    val n = (totalSamples - start).toInt().coerceAtLeast(0)
    return FloatArray(n) { ring[((start + it) % ring.size).toInt()] }
  }

  private fun concat(parts: List<FloatArray>): FloatArray {
    val out = FloatArray(parts.sumOf { it.size })
    var i = 0
    parts.forEach { it.copyInto(out, i); i += it.size }
    return out
  }

  // Cada tramo de voz se transcribe con NeMo para buscar "Alfred" (ADR-018).
  private fun listen(detector: Vad, samples: FloatArray, kwsHit: Boolean) {
    detector.acceptWaveform(samples)
    drain(detector, kwsHit)
  }

  private fun drain(detector: Vad, kwsHit: Boolean) {
    while (!detector.empty()) {
      val segment = detector.front().samples
      detector.pop()
      if (segment.size < SAMPLE_RATE / 4) continue
      val at = System.currentTimeMillis()
      val endSample = totalSamples
      worker?.execute {
        val (text, ms) = decode(nemo, segment)
        val match = WAKE_IN_TEXT.find(text.lowercase())
        val audioMs = segment.size * 1000L / SAMPLE_RATE
        // Lo que sigue a "Alfred" en el mismo tramo ("Hola Alfred, ¿qué hora es?") ya es el comando.
        val rest = match?.let { text.substring(minOf(it.range.last + 1, text.length)).trim().trimStart(',', '.', ' ', '¿', '?') }.orEmpty()
        val inlineCommand = rest.split(Regex("\\s+")).count { it.any(Char::isLetter) } >= 2
        log(if (diagnostic) "heard kws=$kwsHit textWake=${match != null} audioMs=$audioMs decodeMs=$ms text=\"$text\""
            else "heard kws=$kwsHit textWake=${match != null} audioMs=$audioMs decodeMs=$ms")
        if (diagnostic || match != null) AudioEvents.send("heard", "text" to text, "kws" to kwsHit, "textWake" to (match != null), "audioMs" to audioMs, "at" to at)
        saveWav("heard-${if (kwsHit) "kws" else "nokws"}", at, segment, text)
        // Si el detector ya activó con esta misma frase (hasta 1 s después del fin del tramo), no se repite.
        val alreadyWoken = lastWakeSample > endSample - SAMPLE_RATE
        if (match != null && !kwsHit && !alreadyWoken) {
          if (inlineCommand) {
            lastWakeSample = endSample
            val n = wakeCount.incrementAndGet()
            log("wake source=text-inline keyword=ALFRED count=$n")
            AudioEvents.send("wake", "text" to "ALFRED", "source" to "text-inline", "count" to n)
            log("transcript source=inline audioMs=$audioMs nemoMs=$ms text=\"$rest\"")
            AudioEvents.send("transcript", "text" to rest, "elapsedMs" to ms, "audioMs" to audioMs, "at" to at)
          } else {
            textWakes.add(TextWake(endSample))
          }
        }
      }
    }
  }

  private fun transcribeCommand(audio: FloatArray) {
    val at = System.currentTimeMillis()
    worker?.execute {
      val audioMs = audio.size * 1000L / SAMPLE_RATE
      val (text, ms) = decode(nemo, audio)
      log("transcript audioMs=$audioMs nemoMs=$ms text=\"$text\"")
      AudioEvents.send("transcript", "text" to text.ifBlank { "(sin transcripción)" }, "elapsedMs" to ms, "audioMs" to audioMs, "at" to at)
      saveWav("command", at, audio, text)
    }
  }

  private fun decode(recognizer: OfflineRecognizer?, audio: FloatArray): Pair<String, Long> {
    val r = recognizer ?: return "" to 0L
    val started = SystemClock.elapsedRealtime()
    val stream = r.createStream()
    stream.acceptWaveform(audio, SAMPLE_RATE)
    r.decode(stream)
    val text = r.getResult(stream).text.trim()
    stream.release()
    return text to (SystemClock.elapsedRealtime() - started)
  }

  // Guarda el tramo como WAV 16 kHz mono solo si se pidió; queda en el almacenamiento de la app en el teléfono.
  private fun saveWav(kind: String, at: Long, audio: FloatArray, text: String) {
    val dir = evalDir ?: return
    val base = "$at-$kind"
    val pcm = java.nio.ByteBuffer.allocate(44 + audio.size * 2).order(java.nio.ByteOrder.LITTLE_ENDIAN).apply {
      put("RIFF".toByteArray()); putInt(36 + audio.size * 2); put("WAVE".toByteArray())
      put("fmt ".toByteArray()); putInt(16); putShort(1); putShort(1); putInt(SAMPLE_RATE); putInt(SAMPLE_RATE * 2); putShort(2); putShort(16)
      put("data".toByteArray()); putInt(audio.size * 2)
      audio.forEach { putShort((it.coerceIn(-1f, 1f) * 32767).toInt().toShort()) }
    }
    File(dir, "$base.wav").writeBytes(pcm.array())
    File(dir, "events.jsonl").appendText("{\"file\":\"$base.wav\",\"kind\":\"$kind\",\"text\":${org.json.JSONObject.quote(text)}}\n")
  }

  // Pulso cada 5 s con el nivel del micrófono: distingue "el servicio dejó de escuchar"
  // de "escucha pero no detecta" al leer el registro.
  private fun heartbeat(samples: FloatArray) {
    var sum = 0.0
    for (s in samples) sum += s * s
    levelSum += sum
    levelCount += samples.size
    val now = SystemClock.elapsedRealtime()
    if (now - lastBeatAt < HEARTBEAT_MS) return
    val rms = if (levelCount == 0) 0.0 else Math.sqrt(levelSum / levelCount)
    val dbfs = if (rms > 0) 20 * Math.log10(rms) else -120.0
    log("alive mode=${if (commandStartedAt == 0L) "wake" else "command"} dbfs=${"%.1f".format(dbfs)}")
    lastBeatAt = now
    levelSum = 0.0
    levelCount = 0
  }

  // Copia los modelos de assets a almacenamiento privado una vez por instalación del APK
  // (lastUpdateTime cambia en cada instalación, así un modelo nuevo nunca queda sin copiar).
  // Copia a un directorio temporal y lo renombra al final, así un corte a medias no deja modelos rotos.
  private fun ensureModels(): File {
    val root = File(filesDir, "models")
    @Suppress("DEPRECATION")
    val installedAt = packageManager.getPackageInfo(packageName, 0).lastUpdateTime
    val marker = File(root, ".complete-$installedAt")
    if (marker.exists()) return root
    AudioEvents.send("status", "message" to "Preparando modelos (solo la primera vez)…")
    val staging = File(filesDir, "models.tmp")
    staging.deleteRecursively()
    copyAssets("models", staging)
    val missing = REQUIRED.map { File(staging, it) }.filterNot { it.exists() }
    check(missing.isEmpty()) { "Faltan modelos sherpa-onnx: ${missing.joinToString { it.name }}" }
    root.deleteRecursively()
    check(staging.renameTo(root)) { "No pude mover los modelos a ${root.path}" }
    File(root, marker.name).createNewFile()
    log("models_ready")
    return root
  }

  private fun copyAssets(assetPath: String, destination: File) {
    val entries = assets.list(assetPath).orEmpty()
    if (entries.isEmpty()) {
      destination.parentFile?.mkdirs()
      assets.open(assetPath).use { input -> destination.outputStream().use { output -> input.copyTo(output) } }
    } else {
      destination.mkdirs()
      entries.forEach { copyAssets("$assetPath/$it", File(destination, it)) }
    }
  }

  // Una línea por evento en logcat (etiqueta VigiaMetrics) para medir desde el PC sin mirar la pantalla.
  // También se escribe en un archivo diario del teléfono: logcat se pierde al reiniciar o se sobrescribe.
  private fun log(event: String) {
    val line = "t=${System.currentTimeMillis()} $event"
    Log.i(TAG, line)
    try {
      val dir = File(getExternalFilesDir(null), "logs").apply { mkdirs() }
      val day = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())
      synchronized(LOG_LOCK) { File(dir, "vigia-$day.log").appendText(line + "\n") }
    } catch (_: Exception) { }
  }

  override fun onDestroy() {
    active = false
    // stop() unblocks AudioRecord.read(); the audio thread owns release() in finally.
    try { recorder?.stop() } catch (_: Exception) { }
    // Sin interrupt(): interrumpir el hilo mientras espera al worker cerraba la app (16 oct).
    audioThread?.join(6000)
    wakeLock?.let { if (it.isHeld) it.release() }
    log("stopped")
    AudioEvents.send("stopped", "message" to "Servicio detenido")
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    @Volatile var running = false
      private set
    const val EXTRA_DIAGNOSTIC = "diagnostic"
    const val EXTRA_SAVE_AUDIO = "saveAudio"
    private const val TAG = "VigiaMetrics"
    private val LOG_LOCK = Any()
    private const val CHANNEL = "vigia-audio"
    private const val NOTIFICATION_ID = 1200
    private const val SAMPLE_RATE = 16000
    private const val COMMAND_TIMEOUT_MS = 6000L
    private const val SKIP_AFTER_WAKE_MS = 150L
    private const val COMMAND_END_SILENCE_MS = 700L
    private const val MAX_COMMAND_S = 8
    private const val HEARTBEAT_MS = 5000L
    // Umbral por defecto; keywords.txt fija uno propio por frase (#0.15/#0.2) tras detectar 1 de ~30 intentos (16 oct).
    private const val KWS_THRESHOLD = 0.25f
    // Palabra que empieza con "alf" o "al fr/fe" (17 oct: "al fe" y "ella alf" eran "Hola Alfred"). Riesgo: "alfombra".
    private val WAKE_IN_TEXT = Regex("(?<!\\p{L})(alf\\p{L}*|al f[re]\\p{L}*)")
    private const val KWS_ENCODER = "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx"
    private const val KWS_DECODER = "decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx"
    private const val KWS_JOINER = "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx"
    private val REQUIRED = listOf(
      "kws/$KWS_ENCODER", "kws/$KWS_DECODER", "kws/$KWS_JOINER", "kws/tokens.txt", "kws/bpe.model", "kws/keywords.txt",
      "nemo-es/model.int8.onnx", "nemo-es/tokens.txt", "silero_vad.onnx",
    )
  }
}
