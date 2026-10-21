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

**Estado al 22 oct 2026:** fases 0 a 3 cerradas. Por decisión de Gonzalo se adelantó de la fase 6 una primera versión de la pantalla principal (esfera de estado, temporizadores en vivo, recordatorios por día e historial; ajustes aparte). Siguiente: fase 4 (dispositivos). Fase 1: el ciclo de voz completo funciona; "¿qué hora es?" respondió bien 5 de 9 desde ~3 m con una reunión a menos de 1 m (meta 10/10 no alcanzada). Gonzalo lo aceptó; la precisión con ruido se sigue midiendo con el set `eval/`.

## Backlog por fase

### Fase 0

- [x] Crear proyecto React Native bare con código nativo accesible (RN 0.88.0)
- [x] `VoiceService.kt` como foreground service tipo micrófono
- [x] Integrar sherpa-onnx: detector de palabra clave, VAD y voz a texto; tras medir, activación híbrida (ADR-018) y NeMo español (ADR-019)
- [x] Puente de eventos a JS y pantalla de diagnóstico
- [x] Compilar APK release arm64-v8a con modelos incluidos (149 MB) e instalar en el Realme
- [x] Activaciones falsas con TV: 0 en 24 min reales y 0 simuladas en 67 min con la regla de inicio de frase (20 oct). Gonzalo decidió omitir la corrida formal de 2 h (A2) y cerrar la fase; se vigila en el uso diario. Pantalla apagada: 67 min sin cortes. Latencia: NeMo 120–290 ms por comando
- [x] Instalar y probar en el Realme (16–20 oct): 5 rondas con registro
- [x] Confirmar "Alfred" en español e inglés: 12 de ~13 (~92 %) con teléfono bloqueado (20 oct); "Hey Alfred" también por el detector
- [x] Reiniciar el teléfono: el servicio arrancó solo con micrófono real y respondió "¿Qué hora es?" (20 oct, ADR-003). Requiere "Mostrar sobre otras apps" e inicio automático activados a mano en el Realme
- [x] Alternativa al detector: activación por texto con NeMo (ADR-018) en vez de openWakeWord

### Fase 1

- [x] Máquina de estados con tests (`src/orchestrator`, 28 pruebas)
- [x] TTS nativo en español con voz elegible (es-us-x-esf-network) y pantalla de respuesta sobre el bloqueo (ADR-012)
- [x] Audio focus: bajar y restaurar volumen; tono al activar; no escucha mientras habla
- [x] Arranque automático al encender (20 oct) y escalera de batería del ADR-015 (ajustes de Realme y lista blanca de batería por ADB)

### Fase 2

- [x] Normalizador de números, horas y fechas relativas en español (`src/nlu`)
- [x] Set de frases por intención: `eval/nlu.jsonl`, 96 frases (de Gonzalo, transcripciones reales y sintéticas); intención y slots 100 % en dev y test (test visto en parte al ajustar)
- [x] Recordatorios en SQLite con alarmas exactas (`setAlarmClock`) y reprogramación al encender (ADR-009)
- [x] Hora, fecha (incluido "¿qué día es el 20 de noviembre?"), temporizadores, crear, listar y borrar recordatorios, con preguntas cuando falta un dato
- [x] Alarmas y temporizadores se detienen con "Alfred, para", "para" o el botón (pulsos de 2 s, máximo 2 min)
- [x] Probado en el Realme el 21 oct: temporizador sonó a los 5,01 s y se detuvo con la voz; recordatorio con pregunta de hora; Gonzalo confirmó recordatorio tras reinicio

### Fase 3

- [x] Detectar Echo conectado por Bluetooth (A2DP, `AudioManager.getDevices`)
- [x] Controles de reproducción por la sesión multimedia de Apple Music (pausa, sigue, siguiente, anterior) y volumen
- [x] "Pon X" con `playFromSearch` en la sesión, indicando artista, canción o álbum; dice lo que de verdad sonó
- [x] Probado en el Realme el 21–22 oct: reproducir, pausar, volumen y búsqueda por artista funcionan. Límite: títulos en inglés que NeMo transcribe mal ("bohemia en Rhapsody")

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
