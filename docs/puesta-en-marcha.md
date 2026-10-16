# Puesta en marcha en el PC

Prepara el PC y el teléfono antes de la fase 0. El repo vive en `G:\Alexo`.

## 1. Herramientas

| Herramienta | Para qué | Comprobación |
| --- | --- | --- |
| Git | Control de versiones | `git --version` |
| Node.js LTS | App React Native y puente LLM | `node -v` |
| JDK 17 | Compilar Android | `java -version` |
| Android Studio, SDK y platform-tools | Compilar e instalar; ADB | `adb version` |
| Codex CLI con sesión de tu cuenta Pro | Desarrollar y futuro puente LLM (según instrucción vigente; ver nota) | `codex --version`; `codex login status` |
| Python 3.11+ y paquete `sherpa-onnx` | Convertir las frases de Alfred a tokens y probar modelos en el PC | `sherpa-onnx-cli text2token --help` |
| Ollama | LLM de respaldo | `ollama --version` |

No crear ni usar `ANTHROPIC_API_KEY`. La configuración local vigente indica Codex CLI con plan Pro. ADR-011 y el documento fuente aún describen Claude; hay que resolver esa divergencia con un ADR antes de implementar el puente LLM. El doctor solo consulta el estado local de inicio de sesión de Codex; no ejecuta un prompt.

## 2. Preparar el teléfono (una vez)

1. Ajustes → Acerca del teléfono → tocar 7 veces el número de compilación; luego activar Depuración USB en Opciones de desarrollador.
2. Conectar por USB, aceptar la huella del PC y comprobar que `adb devices` lo lista.
3. Emparejar el Echo Pop: decir "Alexa, empareja Bluetooth" y elegirlo desde el teléfono.
4. En la app WiZ, activar la comunicación local.
5. En el router, reservar IP fija para el teléfono, el PC, la TV y cada ampolleta.
6. En la TV, activar el encendido por red y anotar su MAC.
7. Cuando la app esté instalada, aplicar la escalera del ADR-015: en Realme, Batería → uso por app → Vigía → permitir actividad en segundo plano e inicio automático; luego los comandos ADB de abajo.

```bash
# Datos del teléfono
adb shell getprop ro.build.version.release   # esperado: 11
adb shell getprop ro.product.cpu.abi         # esperado: arm64-v8a

# Tras instalar la app (paquete provisorio cl.vigia.app)
adb shell dumpsys deviceidle whitelist +cl.vigia.app
adb shell cmd appops set cl.vigia.app RUN_IN_BACKGROUND allow
adb shell cmd appops set cl.vigia.app RUN_ANY_IN_BACKGROUND allow
```

```bash
# Arranque al encender en Android 11 (ADR-003): permitir abrir la actividad que inicia el servicio
adb shell appops set cl.vigia.app SYSTEM_ALERT_WINDOW allow
```

No se rootea ni se cambia la versión de Android.

## 3. Comprobaciones automáticas (`npm run doctor`)

| Comprobación | Cómo | Pasa si |
| --- | --- | --- |
| Teléfono conectado | `adb devices` | Un dispositivo autorizado |
| Versión y arquitectura | `getprop` | Android 11, arm64-v8a |
| Sesión Codex | `codex login status` | CLI confirma sesión iniciada |
| Ollama | `GET http://localhost:11434/api/tags` | Responde con al menos un modelo |
| Luces WiZ | Broadcast UDP `getPilot` al puerto 38899 | Lista ampolletas con IP y MAC |
| TV Samsung | `GET http://IP-TV:8001/api/v2/` | JSON con `"OS": "Tizen"` |
| Teléfono alcanza al PC | Petición HTTP al puente desde `adb shell` | Respuesta 200 |

## 4. Specs del PC y modelo de respaldo

Medido el 13 de octubre: Windows 11 Home, Intel i5-9300H (4 núcleos, 8 hilos), 16 GB de RAM, GeForce GTX 1050 de 3 GB. El respaldo parte con un modelo de 3B cuantizado (por ejemplo `qwen2.5:3b`), que cabe en la GPU; uno de 7 a 8B no cabe y correría en CPU, demasiado lento. La decisión final sale de `eval/tools.jsonl` y se registra en el ADR-016.

## 5. Prompt por fase

El estado real, los comandos de continuación y los pendientes de la fase 0 están en [estado-actual.md](estado-actual.md). Último doctor (16 oct 2026): 11/14 sin fallos; teléfono no detectado, Ollama apagado y WiZ sin respuesta; TV omitida sin IP.

```text
Implementa la fase N de docs/roadmap.md, solo esa fase.
Antes de programar, crea o amplía sus sets en eval/ según docs/evaluacion.md.
Al terminar, corre npm test, npm run eval y npm run doctor, y reporta cada
métrica de la fase con su número de casos, contra la meta, más los tres errores
más frecuentes y su causa. Agrega la fila a docs/metricas.md.
Si algo contradice un ADR, detente y propón un ADR nuevo.
```
