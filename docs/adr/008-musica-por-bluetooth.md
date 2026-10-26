# ADR-008: Música por Bluetooth al Echo

**Estado:** Aceptada

## Contexto

Amazon no ofrece una API abierta para ordenarle reproducción a un Echo, y las integraciones no oficiales son frágiles.

## Decisión

El Echo se empareja como parlante Bluetooth. La app controla Apple Music en el Android con intents y controles multimedia del sistema (play, pausa, siguiente, volumen).

## Consecuencias

Control básico confiable. Pedir una canción específica por nombre depende de lo que Apple Music acepte vía búsqueda por intent, y hay que probarlo en la fase 3.

## Alternativas

Integración no oficial de Alexa; cambiar a un servicio con API de reproducción remota.

## Actualización 22 oct: cómo se controla Apple Music

Probado en el Realme con Apple Music 6.5.3:

| Vía | Resultado |
| --- | --- |
| Intent `MEDIA_PLAY_FROM_SEARCH` desde otra app | Abre Apple Music y no reproduce (parece reservado a Google Assistant) |
| Teclas multimedia | Funcionan si Apple Music ya tiene algo en cola |
| Sesión multimedia (`MediaController`) | Acepta `PLAY_FROM_SEARCH`, play, pausa, saltos; es la vía elegida |

Obtener la sesión de otra app exige "Acceso a notificaciones". Gonzalo lo autorizó el 22 oct solo para esto; `MediaListener` no lee ni guarda notificaciones. La búsqueda lleva los mismos extras que Google Assistant (`EXTRA_MEDIA_FOCUS`, artista, título, álbum) y la respuesta dice lo que de verdad empezó a sonar.


## Actualización 26 oct: biblioteca y nombres en inglés

- La biblioteca de Gonzalo no es accesible desde otra app: `MediaBrowser` hacia Apple Music es rechazado y las búsquedas ("mi biblioteca", "my library", "mis canciones") y enlaces (`music.apple.com/library/...`) reproducen del catálogo. "Pon mi música" reanuda lo último que sonó; si no hay cola, pide una búsqueda vacía.
- Los nombres en inglés que NeMo transcribe como suenan se corrigen contra una lista de artistas (semilla + los que ya sonaron), por parecido de letras; siglas como "MGK" admiten una letra mal oída (`src/nlu/artists.ts`).
