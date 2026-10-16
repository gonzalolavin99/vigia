# ADR-001: El teléfono es el cerebro

**Estado:** Aceptada

## Contexto

Home Assistant pone la lógica en un servidor y usa el teléfono solo como micrófono. Gonzalo quiere que lo básico funcione sin servidor y sin gastar.

## Decisión

Palabra clave, voz a texto, intenciones, skills y recordatorios corren en el Android. El servidor solo aporta LLM.

## Consecuencias

Funciona con el PC apagado. A cambio hay que escribir una app propia y la capacidad queda limitada por el teléfono.

## Alternativas

Home Assistant con Companion app (menos código, pero servidor obligatorio); Ava como satélite (igual).
