# ADR-002: React Native con módulo nativo Kotlin

**Estado:** Aceptada

## Contexto

Gonzalo domina React y TypeScript. La escucha continua en segundo plano no se puede hacer bien desde JavaScript.

## Decisión

React Native con código nativo accesible (bare o Expo con dev client y prebuild). El servicio de audio va en Kotlin y habla con JS por eventos y Headless JS.

## Consecuencias

Cerca del 80 % del código es TypeScript testeable. Hay que mantener unas pocas clases Kotlin. Expo Go no sirve.

## Alternativas

Kotlin puro (mejor encaje, curva más larga); Flutter (sin ventaja para este equipo).
