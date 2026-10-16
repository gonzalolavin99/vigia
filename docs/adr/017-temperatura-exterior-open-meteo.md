# ADR-017: Temperatura exterior por API del clima

**Estado:** Aceptada (13 oct)

## Contexto

WiZ no mide temperatura y no hay sensor en casa. El principio de costo cero descarta comprar uno para la v1.

## Decisión

Un `WeatherAdapter` consulta Open-Meteo, que es gratis y no pide API key, con las coordenadas configuradas en la app. Responde "afuera hay N grados". Guarda la última lectura 10 minutos en caché.

## Consecuencias

"¿Qué temperatura hay en la pieza?" se responde con la exterior y se aclara. Un sensor interior entra después como otro adaptador con `readSensor`, sin tocar la skill.
