# ADR-016: Puente LLM nativo en Windows, sin Docker

**Estado:** Aceptada (13 oct)

## Contexto

El roadmap preveía un `docker-compose` con el puente y Ollama. Dentro de un contenedor, `claude -p` necesita su propio inicio de sesión de la cuenta Pro, y en Windows eso suma Docker Desktop y WSL sin aportar nada. El PC es un i5-9300H (4 núcleos), 16 GB de RAM y una GTX 1050 de 3 GB, con Windows 11.

## Decisión

El puente es un proceso Node y TypeScript que corre directo en Windows, usa la sesión de Claude Code ya iniciada y llama a Ollama nativo en `localhost:11434`. Escucha solo en la IP de la LAN. Arranca con el PC mediante una tarea programada.

## Consecuencias

Una instalación menos y la misma sesión que se usa para desarrollar. El modelo de respaldo parte en un 3B cuantizado (por ejemplo `qwen2.5:3b`), que cabe en los 3 GB de la GPU; la elección final sale de `eval/tools.jsonl`.

## Alternativas

Docker como decía el roadmap (inicio de sesión aparte dentro del contenedor).
