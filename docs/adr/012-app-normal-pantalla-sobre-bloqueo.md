# ADR-012: App normal con servicio persistente y pantalla sobre el bloqueo

**Estado:** Aceptada

## Contexto

La pregunta era si hacer una app o un proceso del sistema. Un proceso del sistema exige root o una ROM propia para instalarse como app de sistema: más riesgo, se pierde la garantía y no aporta nada que Android no permita ya.

## Decisión

App normal. El servicio de micrófono corre siempre. Al detectar "Alfred" toma un wake lock breve y abre una pantalla de respuesta sobre la de bloqueo, que enciende la pantalla, muestra la información y se apaga sola a los pocos segundos. No desbloquea el teléfono, así que funciona igual con o sin contraseña.

## Consecuencias

No hay que rootear, cambiar la versión de Android ni tocar el sistema. Android 11 soporta todo lo necesario. El teléfono se conecta al PC solo para instalar la app y aplicar ajustes por ADB.

## Alternativas

Root o ROM propia (descartado); launcher en modo kiosco (posible después si se quiere una pantalla tipo reloj permanente).
