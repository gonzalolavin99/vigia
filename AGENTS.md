# Vigía

Asistente de voz local para Android (Realme 6 Pro, Android 11). Lee docs/ antes de cambiar arquitectura; el índice está en docs/README.md. La fuente de verdad de la documentación es el Codex Doc enlazado ahí: si cambias un doc o ADR aquí, avisa para reflejarlo allá.

## Reglas
- El audio nunca sale del teléfono. Solo texto va al servidor, y solo si las reglas no calzan.
- Lógica en TypeScript con tests; Kotlin solo para audio, alarmas y servicio.
- Toda integración externa va detrás de una interfaz (DeviceAdapter, LlmClient).
- Idioma de usuario: español de Chile. Código y commits en inglés.
- Una fase a la vez; no adelantar trabajo de fases futuras.
- Si una decisión contradice un ADR, proponer un ADR nuevo antes de escribir código.
- Nunca crear ni usar ANTHROPIC_API_KEY: el puente LLM usa `Codex -p` con el plan Pro (ADR-011).
- React Native bare (sin Expo Go); el código nativo vive en android/ (ADR-002).
- El teléfono es Android 11 (API 30): verificar cada API y permiso contra esa versión, no contra la última.

## Entorno
- PC: Windows 11, i5-9300H, 16 GB RAM, GTX 1050 3 GB. Puente LLM nativo, sin Docker (ADR-016).
- Paquete Android provisorio: cl.vigia.app.
- Configuración local (IPs, MACs, coordenadas) en vigia.local.json, fuera de git; ver vigia.local.example.json.

## Comandos
- npm run doctor   # comprueba PC, teléfono, Codex, Ollama, WiZ y TV
- npm test
- npm run android
- npm run lint

## Estado
- Puesta en marcha base realizada; última ejecución del doctor (16 oct): 11/14 sin fallos. ADB no vio el teléfono, Ollama no respondía, WiZ no respondió y la TV quedó omitida por falta de IP. Ver docs/estado-actual.md.
- Fase 0 autorizada e iniciada el 16 oct. El prototipo compila, pero falta instalarlo y medirlo en el Realme; no iniciar fase 1 todavía.
- Herramientas en G:\Dev (JDK, Android Studio, SDK, Ollama, Codex CLI, venv de Python); no instalar nada en C:.
