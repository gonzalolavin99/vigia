# Vigía

Asistente de voz local para Android 11. Revisa primero [docs/README.md](docs/README.md) y [AGENTS.md](AGENTS.md).

## Fase 0: spike de audio

1. Prepara dependencias del proyecto con `npm install` (caché configurada en `G:\Dev`).
2. Descarga los modelos sherpa-onnx en assets locales con `powershell -ExecutionPolicy Bypass -File scripts/prepare-models.ps1`.
3. Con el teléfono arm64 conectado y depuración USB autorizada, ejecuta `npm run android`.
4. En Vigía, toca **Iniciar escucha**, di “Hey Alfred” y luego un comando corto en español. La app muestra activaciones, transcripción y latencia.

Los modelos se ignoran en Git y no contienen datos del usuario. El APK debug los copia al almacenamiento privado del teléfono en el primer inicio. El KWS publicado es inglés; las frases “Alfred” y “Oye Alfred” se miden como candidatas y siguen pendientes de validación en español.

## Comandos

- `npm run doctor`
- `npm run android`
- `npm run lint`
- `npm test`
