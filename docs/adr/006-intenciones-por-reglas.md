# ADR-006: Intenciones por reglas, LLM como respaldo

**Estado:** Aceptada

## Contexto

Los comandos domésticos son pocos y repetitivos. Un LLM local en hardware modesto es lento y falla más.

## Decisión

Motor de reglas en TypeScript con patrones en español, normalización de números, horas y fechas relativas. Solo lo que no calza va al LLM, que recibe las skills como herramientas.

## Consecuencias

Respuesta inmediata y determinista para lo común, fácil de testear con tablas de frases. Cada comando nuevo requiere escribir su regla.

## Alternativas

LLM para todo (flexible, lento, depende del servidor); clasificador entrenado (innecesario a esta escala).
