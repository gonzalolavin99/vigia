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

## Actualización 22 oct: la pantalla sobre el bloqueo es la principal

Gonzalo prefirió la pantalla principal (esfera de estado, historial, temporizadores) a una pantalla de respuesta aparte. `MainActivity` se muestra sobre el bloqueo y enciende la pantalla al decir "Alfred" o al sonar una alarma; la respuesta aparece en grande bajo la esfera y, si algo suena, un botón Detener. Se eliminó `ResponseActivity`. Sigue sin desbloquear el teléfono.
