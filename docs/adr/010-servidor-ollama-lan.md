# ADR-010: Servidor Ollama en la red local

**Estado:** Reemplazada por ADR-011 (Ollama pasa a ser respaldo)

## Contexto

Vercel y similares no sirven: son serverless, no alojan modelos y no ven la red de la casa.

## Decisión

Ollama en el PC, expuesto solo en la LAN. La interfaz `LlmClient` permite cambiar a una API en la nube con una línea de configuración. Tailscale si se quiere usar fuera de casa.

## Consecuencias

Gratis y privado, con calidad limitada por el hardware. Si el PC está apagado, la app lo detecta y sigue con las reglas.
