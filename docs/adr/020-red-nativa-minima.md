# ADR-020: Funciones de red mínimas en Kotlin, lógica de dispositivos en TypeScript

**Estado:** Aceptada (22 oct)

## Contexto

La fase 4 controla luces WiZ por UDP (ADR-013) y la TV Samsung por WebSocket seguro con certificado propio, más Wake-on-LAN (ADR-014). React Native no trae UDP, y su WebSocket rechaza el certificado autofirmado de la TV. La regla del proyecto deja Kotlin solo para audio, alarmas y servicio. Agregar `react-native-udp` y un WebSocket alternativo suma dependencias nativas, y el `package-lock.json` está dañado.

## Decisión

Kotlin expone tres funciones de red genéricas, sin saber de marcas ni de dispositivos:

- `udp(host, puerto, mensaje, espera)`: envía (también a broadcast) y devuelve las respuestas.
- `wakeOnLan(mac)`: el paquete mágico para encender.
- `wsExchange(url, mensajes, espera)`: abre el WebSocket aceptando solo el certificado del host pedido en la red local, envía los mensajes tras el primero que llega y devuelve lo recibido.

Más `readConfig()` para leer la configuración de la casa (`files/config/home.json`, copiada desde `vigia.local.json` con `npm run push-config`). Qué significa cada mensaje (protocolo WiZ, teclas de la TV, nombres, zonas y grupos) vive en TypeScript, detrás de `DeviceAdapter`, con pruebas contra transportes falsos.

## Consecuencias

La lógica sigue probándose con Jest. Las funciones de Kotlin son pocas y no cambian al sumar dispositivos. Las MAC e IP de la casa quedan fuera de git. El futuro menú para agregar dispositivos (pedido de Gonzalo, fase 6) escribirá el mismo `home.json`.

## Alternativas

`react-native-udp` y un WebSocket con certificados propios en JS: más dependencias nativas de terceros por mantener.
