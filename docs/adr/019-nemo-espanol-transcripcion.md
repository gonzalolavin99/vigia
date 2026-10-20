# ADR-019: NeMo FastConformer en español para voz a texto

**Estado:** Aceptada (17 oct); reemplaza a Whisper tiny del ADR-004

## Contexto

Whisper tiny multilingüe transcribía mal el español en el Realme ("que diais", "¿Qué obra es?") y a veces inventaba frases repetidas. sherpa-onnx publica `sherpa-onnx-nemo-fast-conformer-ctc-es-1424-int8`, un modelo CTC solo de español (NVIDIA NeMo, 1424 horas). El 17 de octubre se probaron ambos sobre los mismos 7 comandos en el teléfono.

## Decisión

Usar NeMo FastConformer CTC español int8 (unos 126 MB) para transcribir comandos y para la activación por texto (ADR-018). Whisper tiny sale del APK.

## Consecuencias

| | NeMo español | Whisper tiny |
| --- | --- | --- |
| Comando de ~4 s | 150–290 ms | 440–820 ms |
| "¿Qué hora es?" | correcto | "¿Qué obra es?" |
| Alucinaciones | no vistas | repitió una frase inventada 3 veces |

Con 7 comandos la muestra es chica: el WER real se mide con `eval/stt/` (meta menor a 15 %). NeMo no puntúa siempre igual, así que el motor de intenciones de la fase 2 normaliza mayúsculas y signos.

## Alternativas

Whisper base (más pesado y lento que tiny); Moonshine base es (51 MB, no probado; candidato si NeMo falla en ruido).
