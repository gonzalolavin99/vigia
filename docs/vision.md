# Vigía: asistente de voz local en Android

> Exportado el 2026-10-13 de un Claude Doc histórico. **Vigencia en revisión (16 oct 2026):** la instrucción local más reciente especifica Codex CLI con plan Pro para el futuro puente LLM y prohíbe `ANTHROPIC_API_KEY`. Este documento y ADR-011 todavía describen Claude; esa decisión está pendiente de un ADR actualizado y de sincronización con la fuente de verdad. No implementar el puente basándose en la descripción antigua.

Vigía convierte un Android viejo en un asistente tipo Alexa que escucha, entiende y ejecuta comandos en el propio teléfono, y solo consulta un servidor cuando necesita un LLM.

## Alcance

La v1 corre entera en el teléfono; el servidor es opcional y solo aporta conversación.

| Función | Dónde corre | En v1 |
| --- | --- | --- |
| Palabra de activación siempre escuchando | Teléfono | Sí |
| Voz a texto y texto a voz en español | Teléfono | Sí |
| Comandos fijos (hora, temporizador, volumen, ayuda) | Teléfono | Sí |
| Recordatorios y alarmas con aviso por voz | Teléfono | Sí |
| Música: Apple Music en el Android, Echo como parlante Bluetooth | Teléfono | Sí |
| Luces, TV y temperatura | Teléfono: WiZ y TV Samsung por red local; temperatura exterior por Open-Meteo | Sí |
| Conversación libre y comandos ambiguos | PC: Claude con el plan Pro, Ollama de respaldo | Sí, opcional |
| Pedirle a Alexa que reproduzca nativamente | Sin API abierta | No |
| iPhone como base | iOS no permite escucha en segundo plano | No |

Principios: privado por defecto (el audio nunca sale del teléfono), costo cero en hardware y servicios, y cada fase entrega algo usable.

## Decisiones clave

Detalle en [adr/](adr/).

| ADR | Decisión |
| --- | --- |
| 001 | El teléfono es el cerebro; el servidor es opcional |
| 002 | React Native (sin Expo Go) para UI y lógica, módulo nativo Kotlin para el audio |
| 003 | Foreground service de micrófono, arranque al encender, sin optimización de batería |
| 004 | sherpa-onnx como motor único de voz; activación con "Alfred" sin entrenar un modelo |
| 005 | Porcupine descartado: su plan gratuito terminó el 30 de junio de 2026 |
| 006 | Intenciones por reglas en TypeScript; el LLM solo como respaldo |
| 007 | Dispositivos detrás de adaptadores; en v1, WiZ y TV Samsung |
| 008 | Música por Bluetooth hacia el Echo, sin integraciones no oficiales de Alexa |
| 009 | Recordatorios en SQLite local con alarmas exactas de Android |
| 010 | Reemplazada por ADR-011 |
| 011 | LLM: puente en el PC que usa Claude con el plan Pro vía Claude Code; Ollama si se agota el límite o el PC no tiene sesión |
| 012 | App normal con servicio persistente y pantalla que se enciende sobre el bloqueo; sin root ni ROM modificada |
| 013 | Luces WiZ por UDP local (puerto 38899), sin nube |
| 014 | TV Samsung por WebSocket local (puerto 8002) y Wake-on-LAN para encender |
| 015 | Teléfono dedicado: ajustes de batería de Realme y ADB; modo Device Owner solo si aun así se cae |
| 016 | Puente LLM nativo en Windows, sin Docker |
| 017 | Temperatura exterior por Open-Meteo, sin sensor en v1 |

## Datos de la casa y pendientes

| Tema | Dato | Consecuencia |
| --- | --- | --- |
| Teléfono | Realme 6 Pro, Android 11, Snapdragon 720G, 8 GB RAM, 108 GB libres | Alcanza para palabra clave y Whisper chico en el teléfono; la fase 0 mide cuál |
| PC | Windows 11 Home, i5-9300H (4c/8t), 16 GB RAM, GTX 1050 3 GB | Ollama de respaldo con un modelo 3B cuantizado (ADR-016) |
| Luces | WiZ | Control local por UDP, sin nube (ADR-013) |
| TV | Samsung reciente (Tizen) | Control local por WebSocket; encender requiere Wake-on-LAN (ADR-014) |
| Parlante | Echo Pop | Emparejado como parlante Bluetooth (ADR-008) |
| Activación | "Alfred", "Hey Alfred", "Oye Alfred" | Palabra clave de vocabulario abierto, sin entrenar (ADR-004) |
| LLM | Claude con el plan Pro, sin cobro extra; local como respaldo | Puente en el PC con `claude -p` (ADR-011, ADR-016) |
| Pantalla | Sin contraseña; se enciende al activarse | App con servicio persistente, sin root (ADR-012) |
| Temperatura | Exterior | Open-Meteo, sin API key (ADR-017) |

Pendientes (ninguno bloquea la fase 0):

- [x] CPU, RAM, GPU y sistema operativo del PC
- [ ] Confirmar que el Echo Pop aparece como parlante Bluetooth ("Alexa, empareja Bluetooth")
- [x] Temperatura: exterior por Open-Meteo
- [ ] Modelo exacto de la TV y activar el encendido por red en sus ajustes

## Fuentes

- sherpa-onnx: voz a texto, texto a voz, VAD y detección de palabra clave en Android; existe un wrapper React Native (`@siteed/sherpa-onnx.rn`)
- Fin del plan gratuito de Porcupine: reporte de usuario en el foro de Home Assistant
- Wake words en Home Assistant: microWakeWord on-device en Android
- Ava: referencia de satélite de voz Android open source

Los nombres de modelos y paquetes vienen de resultados de búsqueda y no se probaron; la fase 0 existe para validarlos en el teléfono real.
