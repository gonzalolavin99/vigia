# ADR-014: TV Samsung por WebSocket local

**Estado:** Por validar con el modelo exacto de la TV

## Contexto

Las TV Samsung con Tizen desde 2016 aceptan control remoto por WebSocket seguro en el puerto 8002. La primera conexión muestra un aviso en la TV y entrega un token para las siguientes.

## Decisión

Adaptador Samsung que envía teclas (apagar, volumen, silencio, entrada) y abre apps. Para encender desde apagado se usa Wake-on-LAN con la MAC de la TV, activado en sus ajustes de red.

## Consecuencias

Control local sin cuenta. Si la TV no despierta por red, la alternativa es la API de SmartThings con token personal, que pasa por la nube.

## Actualización 26 oct: encender desde reposo

Probado con la QN50Q8F: Wake-on-LAN no la saca de reposo (sigue en "standby" 18 s después), y en reposo una conexión sin token no recibe respuesta porque espera que se acepte el aviso con la pantalla apagada. Vigía responde al tiro que hay que emparejar ("Alfred, conecta la tele" con la TV encendida) en vez de esperar 30 s. Pendiente: confirmar que con token la tecla de encendido funciona en reposo; si no, la alternativa es SmartThings (nube), como usa Alexa.
