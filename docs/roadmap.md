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

**Estado al 20 oct 2026:** fase 0 en curso. El prototipo corre en el Realme; la activación y la voz a texto se cambiaron tras medir (ADR-018, ADR-019). Faltan TV, pantalla apagada, consumo y reinicio. Ver [estado actual](estado-actual.md).

## Backlog por fase

### Fase 0

- [x] Crear proyecto React Native bare con código nativo accesible (RN 0.88.0)
- [x] `VoiceService.kt` como foreground service tipo micrófono
- [x] Integrar sherpa-onnx: detector de palabra clave, VAD y voz a texto; tras medir, activación híbrida (ADR-018) y NeMo español (ADR-019)
- [x] Puente de eventos a JS y pantalla de diagnóstico
- [x] Compilar APK release arm64-v8a con modelos incluidos (149 MB) e instalar en el Realme
- [ ] Medir activaciones falsas con TV (2 h), pantalla apagada y consumo; latencia ya medida (NeMo 130–290 ms por comando)
- [x] Instalar y probar en el Realme (16–20 oct): 5 rondas con registro
- [ ] Confirmar "Alfred" en español e inglés: híbrido ~65–70 % (9 de ~13, 20 oct; meta más del 90 %); afinar y medir con más casos
- [ ] Reiniciar el teléfono y comprobar arranque/escucha sin tocarlo (no implementado; restricción Android 11, ADR-003)
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
