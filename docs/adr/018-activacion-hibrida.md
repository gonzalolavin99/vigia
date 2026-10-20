# ADR-018: Activación híbrida, detector de palabra clave o "Alfred" en la transcripción

**Estado:** Aceptada (17 oct); reemplaza la parte de activación del ADR-004

## Contexto

El detector de palabra clave de sherpa-onnx solo tiene modelos en inglés. En la prueba del 17 de octubre en el Realme, con unos 36 intentos de "Alfred", "Hey Alfred" y "Hola Alfred" a 1 m y la TV apagada, el detector se activó 7 veces (19 %), aun con umbral bajo y variantes fonéticas. En los mismos tramos, el modelo NeMo en español (ADR-019) escribió "Alfred" en 34 (~95 %), con 0 activaciones por frases sin "Alfred" y 76 ms de decodificación por tramo (p50; p95 117 ms).

## Decisión

Vigía se activa si ocurre cualquiera de dos cosas:

1. El detector de palabra clave reconoce una de las frases de `keywords.txt`.
2. Un VAD separa cada tramo de voz, NeMo lo transcribe y el texto contiene "Alfred" (expresión `alfr|al fr|alfe`).

Si el tramo trae más de una palabra después de "Alfred" ("Hola Alfred, ¿qué hora es?"), ese resto se toma como comando sin esperar otra frase. Si no, se abre la escucha del comando con el audio desde el fin del tramo, guardado en un búfer de 3 s para no perder el inicio. Un tramo que ya activó el detector no vuelve a activar por texto.

## Consecuencias

- Activación mucho mejor en español, sin entrenar un modelo.
- Se transcribe toda voz que oye el teléfono. El texto no sale del teléfono y solo se registra completo en modo diagnóstico.
- Más CPU con voz constante (TV, música): falta medir batería, temperatura y activaciones falsas con TV (A2, A10).
- La activación por texto llega unos 0,5 s después de terminar la frase (silencio del VAD más decodificación).

## Alternativas

Solo el detector (19 %, descartado). Solo transcripción (sin respaldo si NeMo falla). Entrenar microWakeWord u openWakeWord (más eficiente, pero días de trabajo; se puede retomar si el consumo con TV resulta alto).
