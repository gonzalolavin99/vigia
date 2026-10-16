# ADR-009: Recordatorios locales con alarmas exactas

**Estado:** Aceptada

## Contexto

Los recordatorios deben sonar a la hora aunque la app esté cerrada o el teléfono se reinicie.

## Decisión

SQLite como fuente de verdad y `AlarmManager` con alarmas exactas. Al dispararse, el servicio lo anuncia por TTS. Tras un reinicio se reprograman desde la base.

## Consecuencias

Requiere el permiso de alarmas exactas en Android 12 o superior (en el Realme con Android 11 no hace falta). Sin sincronización con otros dispositivos en v1.
