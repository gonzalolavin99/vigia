# ADR-005: Porcupine descartado

**Estado:** Aceptada

## Contexto

Porcupine era la opción más precisa y admitía palabras en español, pero valida una AccessKey al iniciar.

## Decisión

No usarlo. Según un reporte en el foro de Home Assistant, Picovoice cerró el plan gratuito el 30 de junio de 2026 y no planea uno no comercial.

## Consecuencias

La palabra de activación usa un modelo abierto, probablemente entrenado en inglés. Conviene una frase que funcione fonéticamente en ambos idiomas.
