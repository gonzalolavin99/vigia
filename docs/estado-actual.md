# Estado actual y traspaso

Última actualización: 16 de octubre de 2026. Este archivo permite continuar el trabajo desde otro chat. Lee primero [AGENTS.md](../AGENTS.md), [README.md](../README.md) y el [índice](README.md).

## Objetivo y decisiones vigentes

Vigía es un asistente de voz local para el Realme 6 Pro con Android 11 (API 30). El audio se procesa en el teléfono; solo texto podría salir hacia el puente local del PC cuando las reglas no entiendan. El código nativo se limita a audio, alarmas y servicio; la lógica de producto va en TypeScript. No adelantar fases.

La instrucción vigente de Gonzalo establece Codex CLI con plan Pro para el futuro puente LLM y prohíbe crear o usar `ANTHROPIC_API_KEY`. **Hay una contradicción documental pendiente:** ADR-011 y varias páginas aún describen Claude Code. Resolverla con un ADR nuevo y reflejar el cambio en el documento fuente enlazado en `docs/README.md` antes de implementar el puente. No se implementó trabajo LLM en fase 0.

## Estado de fase 0

Gonzalo autorizó iniciar la fase 0 y crear commits el 16 de octubre de 2026. El commit actual es `5d70e9e feat: implement phase zero audio spike`; el commit previo de documentación es `c431d12 chore: initialize Vigia project documentation`.

Implementado en el repositorio:

- Proyecto React Native bare 0.88.0, paquete `cl.vigia.app`, orientado a `arm64-v8a`.
- Pantalla de diagnóstico: iniciar/detener escucha, contar activaciones, mostrar transcripción y latencia.
- Servicio foreground Kotlin con `AudioRecord` mono a 16 kHz, sherpa-onnx KWS, Silero VAD y Whisper Tiny multilingüe configurado para español.
- Audio y modelos permanecen en el dispositivo. Los modelos se descargan/copian con `scripts/prepare-models.ps1`; están fuera de Git. El KWS publicado proviene de GigaSpeech inglés; “HEY ALFRED”, “ALFRED” y “OYE ALFRED” son candidatos experimentales, no validados para español.
- `npm run doctor` revisa herramientas y sesión de Codex sin hacer una llamada al modelo.
- NDK/CMake requeridos por Gradle instalados bajo `G:\Dev`.

Verificado:

- `.\gradlew.bat :app:compileDebugKotlin`: BUILD SUCCESSFUL, tras el arreglo para que el hilo de audio sea dueño de liberar el grabador.
- `:app:assembleDebug`: BUILD SUCCESSFUL antes de ese último arreglo de cierre; reconstruir el APK tras volver a conectar el teléfono.
- APK previo: `android/app/build/outputs/apk/debug/app-debug.apk`, arm64-v8a y aproximadamente 135 MiB. Incluye unos 105 MiB de modelos locales. No contiene otras ABI Android.
- `npm run doctor`: 11/14 sin fallos. Codex CLI, Java 17, ADB, Python/sherpa-onnx detectados. Sin dispositivo ADB; Ollama no respondía; WiZ no respondió; TV omitida por falta de `tvIp`.
- La comprobación `codex login status` devolvió advertencia de limpieza de directorios temporales por permisos, aunque el comando terminó con código cero. Confirmar con el doctor en la siguiente sesión.

Pendiente para cerrar fase 0:

1. Reconectar el Realme por USB, habilitar Depuración USB y aceptar la huella. En Windows el modo **Transferir archivos** es útil, pero lo decisivo es Depuración USB autorizada.
2. Ejecutar `npm run doctor` y confirmar Android 11 y `arm64-v8a`.
3. Ejecutar `npm run android` (o compilar e instalar con Gradle/ADB), probar permiso de micrófono, activaciones, transcripción en español, latencia, falsos positivos con TV y escucha con pantalla apagada.
4. Reiniciar el teléfono y validar el criterio de servicio al arranque de ADR-003; actualmente no se implementó receiver ni arranque automático.
5. Registrar resultados medidos en [ADR-004](adr/004-sherpa-onnx-motor-de-voz.md) y [metricas.md](metricas.md). No declarar fase 0 cerrada hasta cumplir el umbral de latencia/falsos positivos y detección en español e inglés.

## Próximo paso para Gonzalo

Reconectar el celular, dejar **Depuración USB** activa y aceptar el diálogo de confianza. Correr `npm run doctor` desde `G:\Alexo` y compartir la salida. Ollama y WiZ solo hacen falta para que esas comprobaciones del PC pasen; no bloquean la primera prueba de audio en el teléfono.

## Entorno

- Repositorio: `G:\Alexo`; herramientas/SDK/modelos y cachés: `G:\Dev`.
- No instalar herramientas en `C:`. Codex CLI ya está instalado y detectado por el entorno; no reinstalarlo.
- Modelos ignorados por Git y descargables con `powershell -ExecutionPolicy Bypass -File scripts/prepare-models.ps1`.
- El APK y las bibliotecas compiladas son artefactos de build; no añadirlos a Git.
