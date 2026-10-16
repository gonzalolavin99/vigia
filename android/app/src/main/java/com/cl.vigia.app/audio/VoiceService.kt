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
import android.os.SystemClock
import cl.vigia.app.AudioEvents
import cl.vigia.app.R
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import java.io.File
import kotlin.concurrent.thread

class VoiceService : Service() {
  @Volatile private var active = false
  private var recorder: AudioRecord? = null
  private var audioThread: Thread? = null
  private var wakeCount = 0
  private var awaitingCommand = false

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Vigía escucha", NotificationManager.IMPORTANCE_LOW))
    val notification: Notification = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL)
      .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Vigía está escuchando").setContentText("Audio procesado en este teléfono").setOngoing(true).build()
    else @Suppress("DEPRECATION") Notification.Builder(this).setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Vigía está escuchando").setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    else startForeground(NOTIFICATION_ID, notification)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!active) startAudioLoop()
    return START_NOT_STICKY
  }

  private fun startAudioLoop() {
    active = true
    audioThread = thread(name = "VigiaAudio") {
      var spotter: KeywordSpotter? = null
      var wakeStream: com.k2fsa.sherpa.onnx.OnlineStream? = null
      var vad: Vad? = null
      var recognizer: OfflineRecognizer? = null
      try {
        val root = File(filesDir, "models")
        if (!root.exists()) copyAssets("models", root)
        val kws = File(root, "kws")
        val asr = File(root, "whisper")
        val vadModel = File(root, "silero_vad.onnx")
        val required = listOf(File(kws, "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx"), File(kws, "decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx"), File(kws, "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx"), File(kws, "tokens.txt"), File(kws, "bpe.model"), File(kws, "keywords.txt"), File(asr, "tiny-encoder.int8.onnx"), File(asr, "tiny-decoder.int8.onnx"), File(asr, "tiny-tokens.txt"), vadModel)
        val missing = required.filterNot { it.exists() }
        check(missing.isEmpty()) { "Faltan modelos sherpa-onnx: ${missing.joinToString { it.name }}" }
        spotter = KeywordSpotter(config = KeywordSpotterConfig(
          featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
          modelConfig = OnlineModelConfig(transducer = OnlineTransducerModelConfig(encoder = File(kws, "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx").path, decoder = File(kws, "decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx").path, joiner = File(kws, "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx").path), tokens = File(kws, "tokens.txt").path, numThreads = 2, provider = "cpu", modelingUnit = "bpe", bpeVocab = File(kws, "bpe.model").path),
          keywordsFile = File(kws, "keywords.txt").path, keywordsScore = 1.5f, keywordsThreshold = 0.35f))
        wakeStream = spotter.createStream()
        vad = Vad(config = VadModelConfig(sileroVadModelConfig = SileroVadModelConfig(model = vadModel.path, threshold = 0.5f, minSilenceDuration = 0.65f, minSpeechDuration = 0.25f, windowSize = 512, maxSpeechDuration = 8.0f), sampleRate = SAMPLE_RATE, numThreads = 1, provider = "cpu"))
        recognizer = OfflineRecognizer(config = OfflineRecognizerConfig(featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80), modelConfig = OfflineModelConfig(whisper = OfflineWhisperModelConfig(encoder = File(asr, "tiny-encoder.int8.onnx").path, decoder = File(asr, "tiny-decoder.int8.onnx").path, language = "es", task = "transcribe"), tokens = File(asr, "tiny-tokens.txt").path, numThreads = 4, provider = "cpu", modelType = "whisper")))

        val minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        recorder = AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, 4096))
        check(recorder?.state == AudioRecord.STATE_INITIALIZED) { "AudioRecord no se pudo inicializar" }
        recorder?.startRecording()
        AudioEvents.send("status", message = "Escuchando palabra de activación")
        val shortBuffer = ShortArray(512)
        while (active) {
          val count = recorder?.read(shortBuffer, 0, shortBuffer.size) ?: -1
          if (count <= 0) continue
          val samples = FloatArray(count) { shortBuffer[it] / 32768.0f }
          if (!awaitingCommand) {
            wakeStream?.acceptWaveform(samples, SAMPLE_RATE)
            while (spotter?.isReady(wakeStream!!) == true) {
              spotter?.decode(wakeStream!!)
              val result = spotter?.getResult(wakeStream!!)?.keyword.orEmpty()
              if (result.isNotBlank()) {
                spotter?.reset(wakeStream!!)
                vad?.reset()
                awaitingCommand = true
                wakeCount += 1
                AudioEvents.send("wake", text = result, count = wakeCount)
                AudioEvents.send("status", message = "Activación: $result. Di tu comando.")
              }
            }
          } else {
            val detector = vad ?: continue
            detector.acceptWaveform(samples)
            if (!detector.empty()) {
              val segment = detector.front().samples
              detector.pop()
              awaitingCommand = false
              if (segment.size >= SAMPLE_RATE / 4) {
                val started = SystemClock.elapsedRealtime()
                val stream = recognizer!!.createStream()
                stream.acceptWaveform(segment, SAMPLE_RATE)
                recognizer!!.decode(stream)
                val text = recognizer!!.getResult(stream).text.trim()
                stream.release()
                AudioEvents.send("transcript", text = text.ifBlank { "(sin transcripción)" }, elapsedMs = SystemClock.elapsedRealtime() - started)
                AudioEvents.send("status", message = "Escuchando palabra de activación")
              }
            }
          }
        }
      } catch (error: Exception) {
        AudioEvents.send("error", message = error.message ?: error.javaClass.simpleName)
        stopSelf()
      } finally {
        active = false
        try { recorder?.stop() } catch (_: Exception) { }
        recorder?.release(); recorder = null
        wakeStream?.release(); spotter?.release(); vad?.release(); recognizer?.release()
      }
    }
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

  override fun onDestroy() {
    active = false
    // stop() unblocks AudioRecord.read(); the audio thread owns release() in finally.
    try { recorder?.stop() } catch (_: Exception) { }
    audioThread?.interrupt()
    audioThread?.join(1000)
    AudioEvents.send("status", message = "Servicio detenido")
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL = "vigia-audio"
    private const val NOTIFICATION_ID = 1200
    private const val SAMPLE_RATE = 16000
  }
}
