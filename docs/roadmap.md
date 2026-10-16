# Roadmap

Siete fases, cada una termina con algo que se puede usar y un criterio de salida medible. El orden reduce riesgo: lo incierto (audio en segundo plano) va primero.

| Fase | Entrega | Criterio de salida |
| --- | --- | --- |
| 0. Spike de audio | App mínima con servicio Kotlin, palabra clave y transcripción en pantalla | Cumple los umbrales del ADR-004 en el teléfono real, con pantalla apagada, y "Alfred" se detecta en español e inglés |
| 1. Ciclo de voz | Orquestador, tono de escucha, TTS, bajar volumen al escuchar, pantalla de respuesta sobre el bloqueo | "¿Qué hora es?" responde por voz 10 de 10 veces |
| 2. Intenciones y recordatorios | Motor de reglas, skills de tiempo, temporizador y recordatorios | Un recordatorio suena tras reiniciar el teléfono |
| 3. Música | Emparejar Echo, controles multimedia, búsqueda en Apple Music | Play, pausa, siguiente y volumen por voz |
| 4. Dispositivos | `MockAdapter`, luego adaptadores WiZ y TV Samsung | Prender, apagar y atenuar luces WiZ; apagar la TV y cambiar su volumen; decir la temperatura |
| 5. Respaldo LLM | Puente en el PC con un CLI de modelo y Ollama de respaldo, skills como herramientas, modo charla. **CLI por decidir mediante ADR:** instrucción vigente dice Codex; ADR-011 dice Claude | Una frase ambigua ejecuta la skill correcta; con el PC apagado no se cuelga |
| 6. Pulido | Pantalla de ajustes, historial, voz Piper, modo reloj | Una semana de uso sin reiniciar la app a mano |

Antes de la fase 0 va la preparación del PC y del teléfono, descrita paso a paso en [puesta-en-marcha.md](puesta-en-marcha.md). No modifica el sistema del teléfono.

**Estado al 16 oct 2026:** fase 0 iniciada por autorización de Gonzalo. El prototipo compila, pero todavía no se ha probado en el Realme. Ver [estado actual y traspaso](estado-actual.md). La fase 0 sigue abierta.

## Backlog por fase

### Fase 0

- [x] Crear proyecto React Native bare con código nativo accesible (RN 0.88.0)
- [x] `VoiceService.kt` como foreground service tipo micrófono
- [x] Integrar sherpa-onnx: KWS experimental, VAD y Whisper Tiny multilingüe configurado para español
- [x] Puente de eventos a JS y pantalla de diagnóstico
- [x] Compilar Kotlin y APK debug arm64-v8a; falta reconstruir APK tras el arreglo final
- [ ] Medir latencia, activaciones falsas y consumo; registrar resultados en el ADR-004
- [ ] Instalar/probar en el Realme; el PC no detectó dispositivo ADB en la última comprobación
- [ ] Confirmar “Alfred” en español e inglés; el KWS seleccionado se entrenó con inglés y esto sigue experimental
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

- [ ] Resolver primero la contradicción entre la instrucción vigente (Codex CLI) y ADR-011/documentación que aún especifica Claude; proponer ADR y sincronizar el documento fuente antes de implementar el puente
- [ ] Cliente con timeout corto y detección de servidor caído
- [ ] Esquema de herramientas generado desde las skills
- [ ] Modo charla con historial corto

## Definición de terminado

Una tarea está lista cuando tiene tests de la lógica en TypeScript, se probó en el teléfono real con pantalla apagada, y el doc o ADR afectado quedó actualizado.
