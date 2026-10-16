# ADR-008: Música por Bluetooth al Echo

**Estado:** Aceptada

## Contexto

Amazon no ofrece una API abierta para ordenarle reproducción a un Echo, y las integraciones no oficiales son frágiles.

## Decisión

El Echo se empareja como parlante Bluetooth. La app controla Apple Music en el Android con intents y controles multimedia del sistema (play, pausa, siguiente, volumen).

## Consecuencias

Control básico confiable. Pedir una canción específica por nombre depende de lo que Apple Music acepte vía búsqueda por intent, y hay que probarlo en la fase 3.

## Alternativas

Integración no oficial de Alexa; cambiar a un servicio con API de reproducción remota.
