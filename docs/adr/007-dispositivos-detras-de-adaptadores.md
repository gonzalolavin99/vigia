# ADR-007: Dispositivos detrás de adaptadores

**Estado:** Aceptada; adaptadores concretos en ADR-013, ADR-014 y ADR-017

## Contexto

Al decidirlo no se sabía qué marcas había en casa; hoy son luces WiZ y TV Samsung, y la temperatura viene de una API del clima (ADR-017).

## Decisión

Interfaz `DeviceAdapter` con un `MockAdapter` desde el día uno. Luego uno real por marca. Si la marca no tiene API local, un `HomeAssistantAdapter` usa su API REST como puente.

## Consecuencias

Las skills se desarrollan y prueban sin hardware. Home Assistant queda como opción, no como requisito.
