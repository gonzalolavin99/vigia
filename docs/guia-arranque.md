# Guía de arranque

Completa antes [puesta-en-marcha.md](puesta-en-marcha.md); luego pásale a tu agente de código el prompt de la fase 0.

## Antes de programar

1. Anota modelo y versión de Android del teléfono base (Realme 6 Pro, Android 11).
2. Activa opciones de desarrollador y depuración USB.
3. Instala Android Studio, JDK 17 y Node LTS en el PC.
4. Empareja el Echo como parlante Bluetooth del teléfono y confirma que suena.
5. Activa la comunicación local en la app WiZ.

## Prompt para la fase 0

```text
Lee docs/arquitectura.md, docs/adr/ y docs/roadmap.md. Implementa solo la fase 0:
una app React Native mínima con un foreground service en Kotlin que detecte una
palabra de activación con sherpa-onnx, grabe hasta el silencio con VAD, transcriba
con Whisper multilingüe pequeño y envíe el texto a JS para mostrarlo en pantalla.
Antes de escribir código, verifica en la documentación actual de sherpa-onnx los
modelos disponibles para palabra clave y para español, y propón cuáles usar.
Al final, agrega una pantalla de diagnóstico con latencia de transcripción y
conteo de activaciones, para validar el ADR-004.
```

## Frases de prueba

| Intención | Ejemplos |
| --- | --- |
| Hora y fecha | "¿qué hora es?", "¿qué día es hoy?" |
| Temporizador | "pon un temporizador de diez minutos" |
| Recordatorio | "recuérdame llamar a Felipe mañana a las nueve", "¿qué recordatorios tengo?" |
| Música | "pon música", "pausa", "siguiente", "sube el volumen" |
| Luces | "prende la luz del living", "apaga todo" |
| Temperatura | "¿qué temperatura hay en la pieza?" |
| Charla | "conversemos", o cualquier frase sin regla |

## Permisos de Android

`RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `BLUETOOTH_CONNECT`, `INTERNET`.

Se declaran todos, pero en Android 11 solo los de la versión 11 o anterior tienen efecto: `FOREGROUND_SERVICE_MICROPHONE` es de Android 14, `POST_NOTIFICATIONS` de 13, y `SCHEDULE_EXACT_ALARM` y `BLUETOOTH_CONNECT` de 12. Lo que sí exige Android 11 es `foregroundServiceType="microphone"` en el manifiesto. Para arrancar al encender hace falta además `SYSTEM_ALERT_WINDOW`, concedido por ADB (ADR-003).
