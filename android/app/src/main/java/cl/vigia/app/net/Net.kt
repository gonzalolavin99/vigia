package cl.vigia.app.net

import android.content.Context
import java.io.File
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

// Funciones de red genéricas para los adaptadores de dispositivos en TypeScript (ADR-020). No saben de marcas.
object Net {
  data class Reply(val from: String, val payload: String)

  /** Envía [payload] por UDP (a una IP o a broadcast) y junta respuestas durante [waitMs]. */
  fun udp(host: String, port: Int, payload: String, waitMs: Int, attempts: Int = 3): List<Reply> {
    val replies = mutableListOf<Reply>()
    DatagramSocket().use { socket ->
      socket.broadcast = true
      socket.soTimeout = 200
      val bytes = payload.toByteArray()
      val address = InetAddress.getByName(host)
      val until = System.currentTimeMillis() + waitMs
      var sent = 0
      // UDP pierde paquetes: se reenvía hasta [attempts] veces mientras no llegue respuesta.
      while (System.currentTimeMillis() < until) {
        if (sent < attempts && (replies.isEmpty() || host.endsWith(".255"))) {
          socket.send(DatagramPacket(bytes, bytes.size, address, port)); sent++
        }
        val buffer = ByteArray(4096)
        val packet = DatagramPacket(buffer, buffer.size)
        try {
          socket.receive(packet)
          replies += Reply(packet.address.hostAddress ?: "", String(packet.data, 0, packet.length))
          if (!host.endsWith(".255")) break
        } catch (_: SocketTimeoutException) { }
      }
    }
    return replies
  }

  /** Paquete mágico de Wake-on-LAN: 6 bytes 0xFF y la MAC 16 veces, a broadcast en el puerto 9. */
  fun wakeOnLan(mac: String, broadcast: String = "255.255.255.255") {
    val macBytes = mac.split(':', '-').map { it.toInt(16).toByte() }
    require(macBytes.size == 6) { "MAC inválida: $mac" }
    val packet = ByteArray(6) { 0xFF.toByte() } + List(16) { macBytes }.flatten()
    DatagramSocket().use { socket ->
      socket.broadcast = true
      repeat(3) { socket.send(DatagramPacket(packet, packet.size, InetAddress.getByName(broadcast), 9)) }
    }
  }

  /**
   * Abre un WebSocket, espera el primer mensaje del servidor, envía [messages] y junta lo recibido durante [waitMs].
   * Con [insecureLocal] acepta el certificado autofirmado, solo si el host es una IP privada de la red local.
   */
  fun wsExchange(url: String, messages: List<String>, waitMs: Long, insecureLocal: Boolean): List<String> {
    val client = client(url, insecureLocal, 4)
    val received = mutableListOf<String>()
    val done = CountDownLatch(1)
    var sent = false
    val socket = client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
      override fun onMessage(webSocket: WebSocket, text: String) {
        synchronized(received) { received += text }
        if (!sent) { sent = true; messages.forEach { webSocket.send(it); Thread.sleep(150) } }
      }
      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        synchronized(received) { received += """{"event":"vigia.error","message":${org.json.JSONObject.quote(t.message ?: t.javaClass.simpleName)}}""" }
        done.countDown()
      }
      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { done.countDown() }
    })
    done.await(waitMs, TimeUnit.MILLISECONDS)
    socket.close(1000, null)
    client.dispatcher.executorService.shutdown()
    return synchronized(received) { received.toList() }
  }

  /** GET simple (por ejemplo, el estado de la TV); null si no responde. */
  fun httpGet(url: String, waitMs: Long, insecureLocal: Boolean): String? = try {
    client(url, insecureLocal, waitMs / 1000 + 1).newCall(Request.Builder().url(url).build()).execute().use { if (it.isSuccessful) it.body?.string() else null }
  } catch (_: Exception) { null }

  /** POST de JSON con encabezados (por ejemplo, la clave del puente LLM); devuelve código y cuerpo, o null sin conexión. */
  fun httpPost(url: String, json: String, headers: Map<String, String>, connectMs: Long, totalMs: Long): Pair<Int, String>? = try {
    val client = OkHttpClient.Builder().connectTimeout(connectMs, TimeUnit.MILLISECONDS).callTimeout(totalMs, TimeUnit.MILLISECONDS).build()
    val request = Request.Builder().url(url).apply { headers.forEach { (k, v) -> header(k, v) } }
      .post(json.toRequestBody("application/json".toMediaType())).build()
    client.newCall(request).execute().use { it.code to (it.body?.string() ?: "") }
  } catch (_: Exception) { null }

  // Cliente HTTP/WebSocket. Con insecureLocal acepta el certificado propio de un equipo de la casa, solo en IP privada.
  private fun client(url: String, insecureLocal: Boolean, timeoutSeconds: Long): OkHttpClient {
    val host = url.substringAfter("://").substringBefore('/').substringBefore(':')
    return OkHttpClient.Builder().connectTimeout(timeoutSeconds, TimeUnit.SECONDS).readTimeout(timeoutSeconds, TimeUnit.SECONDS).apply {
      if (insecureLocal) {
        require(isPrivate(host)) { "Solo se acepta un certificado propio en la red local" }
        val trustAll = object : X509TrustManager {
          override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
          override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
          override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trustAll), SecureRandom()) }
        sslSocketFactory(ssl.socketFactory, trustAll)
        hostnameVerifier(HostnameVerifier { name, _ -> name == host })
      }
    }.build()
  }

  /** Configuración de la casa (dispositivos, zonas, ubicación), copiada con `npm run push-config`. */
  fun readConfig(context: Context): String? =
    File(context.getExternalFilesDir("config"), "home.json").takeIf { it.exists() }?.readText()

  private fun isPrivate(host: String) =
    host.startsWith("192.168.") || host.startsWith("10.") || Regex("^172\\.(1[6-9]|2\\d|3[01])\\.").containsMatchIn(host)
}
