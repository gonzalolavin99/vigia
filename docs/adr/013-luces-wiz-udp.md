# ADR-013: Luces WiZ por UDP local

**Estado:** Aceptada

## Contexto

Las luces WiZ exponen una API local por UDP en el puerto 38899 con mensajes JSON, documentada por la comunidad y usada en varios proyectos abiertos.

## Decisión

Adaptador WiZ que descubre ampolletas por broadcast, las controla con `setPilot` (encendido, intensidad, temperatura de color, color, escenas) y confirma con `getPilot`. Requiere activar la comunicación local en la app WiZ y conviene reservar IP fija para cada ampolleta en el router.

## Consecuencias

Sin nube ni cuentas, respuesta inmediata. Los nombres ("luz del living") se asignan en la app Vigía.
