# ADR-004: sherpa-onnx como motor de voz

**Estado:** Por validar en fase 0

## Contexto

Se necesitan palabra clave, VAD, voz a texto y texto a voz, offline y gratis.

## Decisión

sherpa-onnx cubre las cuatro funciones en Android con API Kotlin. Voz a texto con VAD + Whisper multilingüe pequeño (no streaming). Texto a voz parte con el TTS nativo de Android y pasa a una voz Piper en español si la calidad no convence.

**Activación (12 oct):** palabra clave de vocabulario abierto de sherpa-onnx: las frases se escriben en un archivo y se convierten a tokens con su herramienta, sin entrenar nada. Frases: "hey alfred", "oye alfred" y "alfred". Los modelos de palabra clave publicados son de inglés o chino, así que "oye" se escribe con su aproximación fonética en inglés y cada frase lleva su propio umbral. Si "alfred" solo da demasiadas activaciones falsas, se exige "hey" u "oye" delante.

## Consecuencias

Una sola dependencia nativa y modelos intercambiables. Los modelos pesan decenas de MB y la latencia depende del teléfono.

## Alternativas

Vosk (más liviano, menos preciso); reconocedor nativo de Android (fácil, pero puede usar la nube según el equipo); openWakeWord o microWakeWord solo para la palabra clave.

**Criterio de validación:** transcripción de un comando de 4 segundos en menos de 2 segundos, y menos de 1 activación falsa por hora con TV encendida.

**Resultados fase 0 (16 oct 2026):** el prototipo compila con KWS sherpa-onnx GigaSpeech (inglés), Silero VAD y Whisper Tiny multilingüe configurado con `language="es"`. APK arm64 debug generado; aún sin instalación ni pruebas en el Realme (ADB no detectó teléfono). Latencia, falsos positivos, consumo, audio con pantalla apagada y detección real en español/inglés siguen **pendientes**. No se considera validado el motor ni cerrada la fase. Ver [estado actual](../estado-actual.md).
