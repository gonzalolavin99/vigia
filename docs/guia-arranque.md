# Guía de arranque

Consulta [estado-actual.md](estado-actual.md) para el último traspaso. La fase 0 ya está autorizada e iniciada; no vuelvas a crear el scaffold. Completa [puesta-en-marcha.md](puesta-en-marcha.md) y continúa con la prueba en teléfono.

## Antes de programar

1. Anota modelo y versión de Android del teléfono base (Realme 6 Pro, Android 11).
2. Activa opciones de desarrollador y depuración USB.
3. Instala Android Studio, JDK 17 y Node LTS en el PC.
4. Empareja el Echo como parlante Bluetooth del teléfono y confirma que suena.
5. Activa la comunicación local en la app WiZ.

## Continuación de fase 0

```text
Lee `CLAUDE.md`, `docs/README.md`, `docs/estado-actual.md`, el roadmap y los ADR pertinentes. Sigue únicamente fase 0. El prototipo RN/sherpa-onnx ya existe y compila; no rehagas el scaffold. Primero confirma el estado ADB y pide a Gonzalo reconectar el Realme si no aparece. Instala y prueba el APK en Android 11 arm64: permiso de micrófono, activaciones, transcripción en español, latencia, falsos positivos con TV, pantalla apagada y arranque después de reinicio. Registra solo mediciones reales en ADR-004 y metricas.md. No cierres fase 0 sin sus criterios de salida. No adelantes fases.
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

El prototipo actual declara `RECORD_AUDIO`, `FOREGROUND_SERVICE` e `INTERNET`; el servicio declara `foregroundServiceType="microphone"`. No declara aún permisos/receptor de arranque automático. Para planificar fases futuras: `FOREGROUND_SERVICE_MICROPHONE` es de Android 14, `POST_NOTIFICATIONS` de 13, y `SCHEDULE_EXACT_ALARM`/`BLUETOOTH_CONNECT` de 12. Para Android 11 el servicio requiere el tipo micrófono en el manifiesto. La reanudación al encender sigue pendiente según ADR-003.
