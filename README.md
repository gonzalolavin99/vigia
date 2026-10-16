# Vigía

Asistente de voz local para Android 11. Revisa primero [docs/README.md](docs/README.md) y [AGENTS.md](AGENTS.md).

## Fase 0: spike de audio

1. Prepara dependencias del proyecto con `npm install` (caché configurada en `G:\Dev`).
2. Descarga los modelos sherpa-onnx en assets locales con `powershell -ExecutionPolicy Bypass -File scripts/prepare-models.ps1`.
3. Con el teléfono arm64 conectado y depuración USB autorizada, ejecuta `npm run android`.
4. En Vigía, toca **Iniciar escucha**, di “Hey Alfred” y luego un comando corto en español. La app muestra activaciones, transcripción y latencia.

Los modelos se ignoran en Git y no contienen datos del usuario. El APK debug los copia al almacenamiento privado del teléfono en el primer inicio. El KWS publicado es inglés; las frases “Alfred” y “Oye Alfred” se miden como candidatas y siguen pendientes de validación en español.

## Estado y continuación en otro chat

La fase 0 está iniciada, pero no cerrada: compilación Kotlin correcta; el APK se había generado antes del último ajuste del servicio y debe reconstruirse; aún no hay mediciones en el Realme porque ADB no lo detectó. El último `npm run doctor` dio 11/14: Codex, Java, ADB y sherpa-onnx disponibles; teléfono ausente, Ollama sin responder, WiZ sin respuesta y TV omitida al faltar su IP. Ver [docs/estado-actual.md](docs/estado-actual.md) para commits, verificación detallada y siguientes pasos.

La instrucción vigente especifica Codex CLI para el futuro puente LLM y prohíbe `ANTHROPIC_API_KEY`, mientras ADR-011 y parte de la documentación aún describen Claude. No implementar el puente hasta resolverlo con un ADR y sincronizar el documento fuente enlazado desde [docs/README.md](docs/README.md).

## Comandos

- `npm run doctor`
- `npm run android`
- `npm run lint`
- `npm test`
