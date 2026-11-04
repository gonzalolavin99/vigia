# ADR-021: Gemini directo desde el teléfono, sin PC

**Estado:** Aceptada (4 nov). Reemplaza a ADR-011 y ADR-016 como camino por defecto; el puente del PC queda en `server/` como opción.

## Contexto

El puente de la fase 5 (ADR-011, ADR-016) exige el PC encendido y abrir el firewall de Windows en la red de la casa. Gonzalo no quiere que el teléfono dependa del PC ni cambiar la configuración de red. Claude directo desde el teléfono necesitaría `ANTHROPIC_API_KEY` y cobraría por uso, cosa que el proyecto prohíbe. Leer las respuestas de IA de la página de Google va contra sus condiciones y se rompe.

## Decisión

Un `GeminiClient` en `src/llm/gemini.ts`, detrás de `LlmClient`, llama a la API de Gemini (Google AI Studio) por HTTPS desde el teléfono, con el nivel gratuito. Usa el mismo prompt y las mismas herramientas que el puente (`src/llm/prompt.ts`). La clave la pega Gonzalo en Ajustes y queda en el teléfono (SharedPreferences), fuera de git. El modelo es configurable; por defecto `gemini-3.5-flash-lite`, gratis según la página de precios del 4 nov.

## Consecuencias

- Solo viaja texto: lo que las reglas no entendieron y los últimos 6 turnos. El audio nunca sale del teléfono.
- En el nivel gratuito Google puede usar ese texto para mejorar sus productos. Gonzalo lo aceptó.
- Sin la búsqueda de Google (en el nivel gratis solo existe para los modelos 2.5, que se retiran el 1 dic), las respuestas generales salen del conocimiento del modelo: sirven para "quién creó los Simpsons", no para noticias de hoy.
- Sin internet o sin clave, Vigía sigue con las reglas y responde "No te entendí bien".
- Los límites del nivel gratis los fija Google y cambian; un 429 se trata igual que sin conexión.

## Alternativas

- **Puente del PC (ADR-016):** sigue en `server/`; si `home.json` trae `bridge`, se usa ese en vez de Gemini.
- **Wikipedia sin clave:** responde "qué es X", pero no entiende órdenes ni conversa.
- **Modelo local en el teléfono:** lento y pobre en un Realme 6 Pro.
