# ADR-004: sherpa-onnx como motor de voz

**Estado:** Aceptada en parte: sherpa-onnx sigue siendo el motor; la activación pasó a ADR-018 y la transcripción a NeMo español (ADR-019) el 17 oct

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

**Resultados fase 0 (17 oct 2026, Realme 6 Pro, 1 m, TV apagada):**

| Medición | Resultado | Meta |
| --- | --- | --- |
| Detector de palabra clave GigaSpeech (inglés), umbral 0,35 | ~3 de 11 intentos | más del 90 % |
| El mismo, umbral 0,15–0,2 + variantes fonéticas | 7 de ~36 (19 %) | más del 90 % |
| "Alfred" en la transcripción NeMo de cada tramo | 34 de ~36 (~95 %), 0 falsas | más del 90 % |
| Decodificación NeMo por tramo de activación | p50 76 ms, p95 117 ms (n=47) | — |
| Comando de ~4 s, NeMo / Whisper tiny | 150–290 ms / 440–820 ms (n=7) | menos de 2 s |

Faltan: activaciones falsas por hora con TV, pantalla apagada, consumo y arranque tras reinicio. Decisiones derivadas: ADR-018 y ADR-019.
