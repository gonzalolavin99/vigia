# ADR-015: Teléfono dedicado sin root

**Estado:** Aceptada

## Contexto

Realme UI restringe procesos en segundo plano para ahorrar batería; sus ajustes están en Batería, dentro del uso de batería por app.

## Decisión

Escalera de medidas, avanzando solo si la anterior no basta:

1. Ajustes de Realme: permitir actividad en segundo plano, inicio automático, bloquear la app en recientes y desactivar el ahorro de energía.
2. ADB desde el PC: excluir la app de la optimización de batería y permitirle correr en segundo plano.
3. Medir con la prueba de 72 horas de [evaluacion.md](../evaluacion.md).
4. Solo si sigue cayendo: modo Device Owner por ADB, que exige quitar las cuentas del teléfono o restablecerlo de fábrica.

## Consecuencias

El teléfono queda dedicado, enchufado y con Wi-Fi estable. Root y ROM propia quedan descartados.
