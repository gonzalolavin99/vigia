# Métricas por fase

Una fila por fase cerrada, según [evaluacion.md](evaluacion.md). Cada métrica lleva su número de casos.

| Fecha | Versión | Fase | Métricas (n casos) | Tres errores más frecuentes y causa |
| --- | --- | --- | --- | --- |
| 2026-10-16 | prototipo inicial | 0, compilación | Kotlin: compilación exitosa; APK arm64 generado antes del último ajuste. Casos en teléfono: 0. `doctor`: 11/14 sin fallos (3 fallos de entorno) | Aún no hay mediciones acústicas; el teléfono no apareció por ADB. Ollama no respondió y WiZ no respondió; son fallos de disponibilidad, no resultados del motor de voz. |
| 2026-10-20 | prototipo con activación híbrida | 0, en curso | Detector inglés: 7/~36 (19 %). "Alfred" en texto NeMo: 34/~36 (~95 %), 0 falsas sin TV. Híbrido en uso: 9/~13 (~65–70 %). Comando: NeMo 130–290 ms (n=16), Whisper tiny 440–820 ms (n=7) | 1) Tramos cortos de ~0,5 s donde NeMo escribe "al fe"/"ella alf": se amplió la búsqueda de texto. 2) Errores de transcripción ("días es hoy", "qué comer"): los absorberá el motor de reglas. 3) Detector de palabra clave entrenado en inglés: reemplazado por el híbrido. |
