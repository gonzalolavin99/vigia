# ADR-011: Claude con el plan Pro vía Claude Code, Ollama de respaldo

**Estado:** Aceptada; revisar si cambian los términos

## Contexto

Gonzalo paga Claude Pro y no quiere cobros extra. La API de Claude se factura aparte del plan, así que una API key sí cobraría. Claude Code viene incluido en Pro, y la página de ayuda de Anthropic (actualizada en octubre de 2026) indica que `claude -p` y el Agent SDK siguen consumiendo los límites de la suscripción. Anthropic ha dicho que el uso personal y el desarrollo local con `claude -p` están bien; lo que no permite es ofrecer el login del plan a terceros o montar un producto sobre él.

## Decisión

Un servidor puente en el PC (Node y TypeScript) recibe texto del teléfono por la red local, llama a `claude -p` con salida JSON y un prompt de sistema corto, y devuelve una herramienta con argumentos o un texto. Claude no recibe permiso para tocar archivos ni ejecutar comandos en el PC; el teléfono ejecuta la acción. Si Claude falla por límite, error o timeout, el puente cae a Ollama; si tampoco hay, el teléfono responde que no puede.

## Consecuencias

- Costo cero mientras se respeten los límites del plan, que se comparten con el chat y Claude Code.
- Mayor latencia que la API, porque cada llamada arranca la CLI; se mide en la fase 5.
- Uso estrictamente personal: un usuario, una suscripción, sin exponer el puente a internet.
- La variable `ANTHROPIC_API_KEY` nunca debe existir en el entorno del puente: si existe, Claude Code la usa y cobra por API. El puente verifica esto al arrancar.
- Los términos han cambiado varias veces en 2026; `LlmClient` permite pasar a Ollama o a una API key con una línea de configuración.

## Alternativas

API key (cobra por uso aunque sean centavos); solo Ollama (gratis, calidad limitada por el PC).
