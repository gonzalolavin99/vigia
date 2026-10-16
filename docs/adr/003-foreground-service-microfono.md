# ADR-003: Foreground service de micrófono

**Estado:** Aceptada

## Contexto

Android detiene procesos en segundo plano y restringe el micrófono fuera de un servicio visible.

## Decisión

Foreground service con tipo `microphone`, notificación persistente, receptor de `BOOT_COMPLETED`, y solicitud de exención de optimización de batería en el primer arranque.

## Consecuencias

Notificación permanente e indicador de micrófono siempre visibles. El teléfono debe quedar enchufado.

## Alternativas

Registrarse como asistente digital del sistema (más integración, más complejidad; se puede evaluar después).

**Restricción de Android 11 (13 oct):** un foreground service iniciado en segundo plano, incluido el receptor de `BOOT_COMPLETED`, no recibe audio del micrófono: graba silencio. Al arrancar, el receptor abre una actividad transparente que inicia el servicio desde primer plano y se cierra; abrir actividades en segundo plano requiere el permiso de mostrar sobre otras apps (`SYSTEM_ALERT_WINDOW`), que se concede una vez por ADB. Se valida en la fase 0 reiniciando el teléfono y comprobando que "Alfred" responde sin tocarlo. Si falla, el respaldo es el modo Device Owner del ADR-015.
