# Roadmap

Siete fases, cada una termina con algo que se puede usar y un criterio de salida medible. El orden reduce riesgo: lo incierto (audio en segundo plano) va primero.

| Fase | Entrega | Criterio de salida |
| --- | --- | --- |
| 0. Spike de audio | App mínima con servicio Kotlin, palabra clave y transcripción en pantalla | Cumple los umbrales del ADR-004 en el teléfono real, con pantalla apagada, y "Alfred" se detecta en español e inglés |
| 1. Ciclo de voz | Orquestador, tono de escucha, TTS, bajar volumen al escuchar, pantalla de respuesta sobre el bloqueo | "¿Qué hora es?" responde por voz 10 de 10 veces |
| 2. Intenciones y recordatorios | Motor de reglas, skills de tiempo, temporizador y recordatorios | Un recordatorio suena tras reiniciar el teléfono |
| 3. Música | Emparejar Echo, controles multimedia, búsqueda en Apple Music | Play, pausa, siguiente y volumen por voz |
| 4. Dispositivos | `MockAdapter`, luego adaptadores WiZ y TV Samsung | Prender, apagar y atenuar luces WiZ; apagar la TV y cambiar su volumen; decir la temperatura |
| 5. Respaldo LLM | Puente en el PC con Claude del plan Pro y Ollama de respaldo, skills como herramientas, modo charla | Una frase ambigua ejecuta la skill correcta; con el PC apagado no se cuelga |
| 6. Pulido | Pantalla de ajustes, historial, voz Piper, modo reloj | Una semana de uso sin reiniciar la app a mano |

Antes de la fase 0 va la preparación del PC y del teléfono, descrita paso a paso en [puesta-en-marcha.md](puesta-en-marcha.md). No modifica el sistema del teléfono.

## Backlog por fase

### Fase 0

- [ ] Crear proyecto React Native con código nativo accesible
- [ ] `VoiceService.kt` como foreground service tipo micrófono
- [ ] Integrar sherpa-onnx: palabra clave con las frases de Alfred y sus umbrales, VAD y Whisper
- [ ] Puente de eventos a JS
- [ ] Medir latencia, activaciones falsas y consumo; registrar resultados en el ADR-004
- [ ] Reiniciar el teléfono y comprobar que el servicio escucha sin tocarlo (restricción de Android 11, ADR-003)
- [ ] Si falla: probar openWakeWord para la palabra clave o el reconocedor nativo para la transcripción

### Fase 1

- [ ] Máquina de estados con tests
- [ ] TTS nativo en español y pantalla de respuesta sobre el bloqueo (ADR-012)
- [ ] Audio focus: bajar y restaurar volumen
- [ ] Arranque automático al encender y escalera de batería del ADR-015

### Fase 2

- [ ] Normalizador de números, horas y fechas relativas en español
- [ ] Tabla de frases de prueba por intención (mínimo 10 cada una)
- [ ] SQLite con migraciones
- [ ] Alarmas exactas y reprogramación tras reinicio
- [ ] "¿Qué recordatorios tengo?" y "borra el de las cinco"

### Fase 3

- [ ] Detectar Echo conectado por Bluetooth
- [ ] Controles multimedia del sistema
- [ ] Probar búsqueda por intent en Apple Music y documentar el límite

### Fase 4

- [ ] Skill de dispositivos contra `MockAdapter`
- [ ] Nombres de dispositivos y habitaciones configurables
- [ ] Adaptadores WiZ (UDP) y Samsung (WebSocket y Wake-on-LAN); temperatura exterior por Open-Meteo (ADR-017)

### Fase 5

- [ ] Puente Node nativo en Windows con `claude -p` y Ollama, en `server/` (ADR-016)
- [ ] Cliente con timeout corto y detección de servidor caído
- [ ] Esquema de herramientas generado desde las skills
- [ ] Modo charla con historial corto

## Definición de terminado

Una tarea está lista cuando tiene tests de la lógica en TypeScript, se probó en el teléfono real con pantalla apagada, y el doc o ADR afectado quedó actualizado.
