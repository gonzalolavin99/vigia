# ADR-014: TV Samsung por WebSocket local

**Estado:** Por validar con el modelo exacto de la TV

## Contexto

Las TV Samsung con Tizen desde 2016 aceptan control remoto por WebSocket seguro en el puerto 8002. La primera conexión muestra un aviso en la TV y entrega un token para las siguientes.

## Decisión

Adaptador Samsung que envía teclas (apagar, volumen, silencio, entrada) y abre apps. Para encender desde apagado se usa Wake-on-LAN con la MAC de la TV, activado en sus ajustes de red.

## Consecuencias

Control local sin cuenta. Si la TV no despierta por red, la alternativa es la API de SmartThings con token personal, que pasa por la nube.
