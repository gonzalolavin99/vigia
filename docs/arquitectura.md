# Arquitectura

Una app React Native con un módulo nativo Kotlin que mantiene el micrófono abierto; todo lo demás es TypeScript.

**Implementación actual (fase 0, 16 oct 2026):** solo existe la pantalla de diagnóstico y el servicio Kotlin de captura/KWS/VAD/Whisper; el orquestador, Headless JS, reglas, skills, persistencia, TTS, adaptadores y puente LLM de esta arquitectura siguen siendo diseño futuro. Para estado detallado, ver [estado-actual.md](estado-actual.md). La descripción del servidor aún está en conflicto con la instrucción vigente de Codex; resolver antes de implementarlo.

## Capas

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Servicio de audio | Kotlin, foreground service | Captura de micrófono, palabra clave, VAD, voz a texto; emite eventos a JS |
| Puente | Native module + Headless JS | Entrega `onWake`, `onTranscript`, `onError` aunque la UI esté cerrada |
| Orquestador | TypeScript | Máquina de estados de la conversación y enrutamiento |
| Intenciones | TypeScript, reglas | Convierte texto en `{intent, slots}` o devuelve `null` |
| Skills | TypeScript | Una por dominio: tiempo, recordatorios, música, dispositivos, charla |
| Adaptadores de dispositivo | TypeScript | Una implementación por marca detrás de `DeviceAdapter` |
| Persistencia | SQLite | Recordatorios, configuración, historial corto |
| Voz de salida | TTS nativo de Android, luego Piper | Respuestas habladas |
| Servidor opcional | Puente Node nativo en el PC (Windows): `claude -p` con el plan Pro y Ollama de respaldo, HTTP en la LAN | Respaldo LLM cuando las reglas no entienden |

## Flujo de un comando

1. El servicio detecta la palabra de activación y baja el volumen de la música.
2. Suena un tono corto y se graba hasta que el VAD detecta silencio.
3. El audio se transcribe en el teléfono.
4. El motor de intenciones busca una regla que calce.
5. Si calza, la skill ejecuta y devuelve un texto de respuesta.
6. Si no calza y hay servidor, el texto va al LLM con la lista de herramientas disponibles.
7. Si no hay servidor, responde que no entendió y sugiere ejemplos.
8. El TTS lee la respuesta y se restaura el volumen.

## Estados del orquestador

`idle` → `listening` → `transcribing` → `resolving` → `speaking` → `idle`. Una respuesta que termina en pregunta vuelve a `listening` sin pedir la palabra de activación. Cualquier error pasa por `speaking` con un mensaje corto y vuelve a `idle`.

## Contratos

```ts
type Intent = { name: string; slots: Record<string, string | number> };

interface Skill {
  intents: string[];
  handle(intent: Intent, ctx: Ctx): Promise<{ say: string; expectReply?: boolean }>;
}

interface DeviceAdapter {
  id: string;
  discover(): Promise<Device[]>;
  setPower(deviceId: string, on: boolean): Promise<void>;
  setBrightness?(deviceId: string, pct: number): Promise<void>;
  readSensor?(deviceId: string, kind: 'temperature' | 'humidity'): Promise<number>;
}

interface LlmClient {
  chat(messages: Msg[], tools: ToolSpec[]): Promise<LlmReply>;
}
```

El LLM recibe las skills como herramientas, así una frase ambigua termina ejecutando la misma skill que una regla.

## Estructura del repo

```
vigia/
  android/app/src/main/java/.../audio/   # VoiceService.kt, WakeEngine.kt, SttEngine.kt
  src/
    orchestrator/    # máquina de estados
    nlu/             # reglas e2e en español, normalización de números y fechas
    skills/          # time, reminders, music, devices, chat
    adapters/        # mock, wiz, samsung, weather (Open-Meteo)
    llm/             # cliente HTTP del puente (nunca API key)
    storage/         # sqlite, migraciones
    ui/              # estado, historial, ajustes
  server/            # puente LLM en Node: claude -p y Ollama (opcional, sin Docker)
  docs/              # este paquete exportado a Markdown, adr/
```

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Android mata el servicio | Foreground service tipo micrófono, exención de batería, reinicio al arrancar, teléfono siempre enchufado |
| La música tapa la palabra de activación | Bajar volumen al detectar voz, teléfono lejos del Echo, botón en pantalla como respaldo |
| Modelo de palabra clave en inglés | Elegir frase que suene bien en ambos idiomas y medir falsos positivos en la fase 0 |
| Voz a texto lenta en teléfono viejo | Modelo más chico, o reconocedor nativo de Android como alternativa |
| Luces sin API local | Adaptador Home Assistant como puente |
| El teléfono se calienta enchufado 24/7 | Limitar carga si el equipo lo permite, brillo mínimo, revisar batería |
| Android 11 no da micrófono a un servicio iniciado al arrancar (graba silencio) | Permiso de mostrar sobre otras apps por ADB; al arrancar se abre una actividad breve que inicia el servicio en primer plano. Validar en fase 0 (ADR-003) |
