# Evaluación y métricas

Cada etapa del pipeline se mide por separado y además de punta a punta, contra un set de pruebas fijo, antes y después de cada cambio. Esa disciplina es lo que distingue medir de "probé y parece que anda".

## Método

1. **Set dorado primero.** Antes de programar una etapa, escribe sus casos de prueba con la respuesta esperada. Si no puedes escribir la respuesta esperada, todavía no sabes qué estás construyendo.
2. **Línea base.** Mide la versión más simple posible y anota el número. Toda mejora se compara contra eso.
3. **Un cambio a la vez.** Cambia una cosa, corre el set completo, compara. Si cambias dos, no sabes cuál ayudó.
4. **Separa desarrollo de prueba.** Ajusta reglas y prompts mirando un set de desarrollo; reporta el número de un set que no miraste. Si afinas contra el mismo set que reportas, el número miente.
5. **Lee los errores.** El número dice cuánto falla; leer 20 fallos y clasificarlos dice por qué.
6. **Mide por etapa y de punta a punta.** Si cada etapa acierta 95 %, cuatro etapas en cadena aciertan cerca de 81 %. El usuario vive el 81.
7. **Regresión automática.** Los sets corren en `npm test`; un cambio que baja una métrica no se mergea sin explicación.

## Métricas por etapa

| Etapa | Métrica | Cómo se calcula | Meta inicial |
| --- | --- | --- | --- |
| Palabra de activación | Activaciones falsas por hora | Dejar TV o podcast 2 horas y contar | Menos de 1 |
| Palabra de activación | Tasa de fallo | Decirla 50 veces a distintas distancias; no detectadas / 50 | Menos de 10 % |
| Voz a texto | WER (tasa de error por palabra) | (sustituciones + borrados + inserciones) / palabras de referencia | Menos de 15 % |
| Intenciones | Exactitud de intención | Frases con intención correcta / total | Más de 95 % |
| Intenciones | Exactitud de slots | Frases con todos los slots correctos / total | Más de 90 % |
| Intenciones | Tasa de respaldo | Frases que caen al LLM / total de uso real | Observar, no optimizar a ciegas |
| LLM | Exactitud de herramienta | Eligió la skill correcta con argumentos correctos / total | Más de 85 % |
| LLM | Acciones inventadas | Ejecutó algo que no se pidió / total | 0 |
| Punta a punta | Éxito de tarea | Comando hablado que termina en la acción correcta / total | Más de 85 % |
| Punta a punta | Latencia p50 y p95 | Fin de la frase hasta inicio de la respuesta | p50 bajo 2 s, p95 bajo 4 s |
| Operación | Horas sin reinicio manual | Registro del servicio | Más de 168 |

Las metas son puntos de partida razonables, no estándares; se ajustan tras la primera medición real.

## Conceptos que conviene dominar

- **Precisión y recall.** En la palabra de activación son opuestos: bajar el umbral reduce fallos y sube activaciones falsas. Se elige el punto de operación mirando ambos, nunca uno solo.
- **Matriz de confusión.** Para intenciones, muestra qué se confunde con qué (por ejemplo temporizador con recordatorio). Dice dónde escribir la próxima regla.
- **Percentiles, no promedios.** Un promedio de 1,5 s esconde que 1 de cada 20 comandos tarda 6 s. El p95 es lo que se siente.
- **Tamaño de muestra.** Con 50 casos, un 90 % medido tiene un margen cercano a ±8 puntos. Pasar de 90 a 92 con 50 casos no es una mejora demostrada.
- **No determinismo del LLM.** Usa temperatura 0 para evaluar y corre cada caso 3 a 5 veces; reporta la tasa de acierto, no un solo intento.
- **LLM como juez.** Solo para lo que no tiene respuesta exacta. Antes de confiar en él, etiqueta tú 30 casos y verifica que el juez coincide contigo.
- **Sesgo del set.** Si todas las frases las escribiste tú, mides qué tan bien el sistema te entiende a ti. Pide frases a otra persona y graba con ruido real.

## Sets de datos del proyecto

| Set | Contenido | Tamaño inicial | Fase |
| --- | --- | --- | --- |
| `eval/wake/` | Grabaciones con y sin la palabra, más audio de fondo | 50 positivos, 2 horas de fondo | 0 |
| `eval/stt/` | Audios de comandos con su transcripción de referencia | 50 | 0 |
| `eval/nlu.jsonl` | Texto, intención y slots esperados | 100, mitad desarrollo y mitad prueba | 2 |
| `eval/tools.jsonl` | Frases ambiguas con la herramienta y argumentos esperados | 40 | 5 |
| `eval/e2e/` | Audios con la acción final esperada | 30 | 5 |

Los audios se graban con el teléfono base, en la posición real, con al menos dos voces.

## Instrumentación

Cada turno guarda un evento en SQLite local: marca de tiempo por etapa, transcripción, intención resuelta, si fue regla o LLM, resultado y error. Con eso salen la latencia por etapa, la tasa de respaldo y los fallos reales para alimentar los sets. Un comando "eso estuvo mal" marca el último turno como fallo y es la fuente más valiosa de casos nuevos.

## Reporte por fase

Al cerrar cada fase se agrega una fila a [metricas.md](metricas.md): fecha, versión, cada métrica con su número de casos, y los tres errores más frecuentes con su causa.

## Experimentos para aprender

- Fase 0: comparar dos tamaños de Whisper en WER y latencia, y elegir con los dos números a la vista.
- Fase 2: medir exactitud de intenciones antes y después de agregar el normalizador de números.
- Fase 5: comparar reglas solas, LLM solo y reglas con respaldo LLM en el mismo set, en exactitud y latencia.
- Fase 5: comparar dos modelos de Ollama y dos versiones del prompt en `eval/tools.jsonl`, con 5 corridas cada uno.

## Plan de pruebas

Tres capas: pruebas automáticas que corren en cada cambio, evals que miden calidad, y pruebas de aceptación en la casa que dicen si la app sirve de verdad.

### Pruebas automáticas

| Nivel | Qué cubre | Herramienta | Cuándo |
| --- | --- | --- | --- |
| Unitarias | Normalizador, reglas, orquestador, skills con dispositivos falsos | Jest | Cada commit |
| Contrato | Adaptadores WiZ y Samsung contra simuladores UDP y WebSocket | Jest con servidores falsos | Cada commit |
| Evals | Sets de `eval/` para NLU, herramientas del LLM y voz a texto | `npm run eval` | Cada cambio de reglas, modelo o prompt |
| Dispositivos reales | WiZ y TV reales desde el PC | `npm run e2e:devices` | Al cerrar fase 4 |
| Puente LLM | Claude y caída a Ollama con el PC sin sesión | `npm run e2e:llm` | Al cerrar fase 5 |

### Pruebas de aceptación en casa

| ID | Escenario | Pasa si |
| --- | --- | --- |
| A1 | Decir "Alfred", "Hey Alfred" y "Oye Alfred" a 1, 3 y 5 m, 10 veces cada una | 9 de 10 o más a 3 m, para cada frase |
| A2 | TV encendida 2 horas sin decir Alfred | Menos de 2 activaciones |
| A3 | Alfred con música sonando en el Echo a volumen normal | 7 de 10 o más |
| A4 | Teléfono bloqueado: "Alfred, ¿qué hora es?" | La pantalla se enciende, muestra y se apaga sola; el teléfono sigue bloqueado |
| A5 | "Alfred, apaga la luz del living" | La luz se apaga, `getPilot` lo confirma, p95 bajo 3 s |
| A6 | TV: apagar, subir volumen, encender por red | 9 de 10 o más por acción |
| A7 | Recordatorio a 2 minutos con teléfono bloqueado, y otro tras reiniciar | Ambos suenan y se muestran |
| A8 | Pregunta abierta con el PC encendido | Responde Claude, p50 bajo 10 s, sin uso nuevo en la consola de API |
| A9 | La misma pregunta con el PC apagado | Mensaje de respaldo en menos de 5 s, sin colgarse |
| A10 | 72 horas sin tocar el teléfono | Servicio vivo, 0 reinicios manuales, batería bajo 40 °C |

### Métricas que agregan estas pruebas

- **Detección por frase e idioma.** "Alfred" solo, "Hey Alfred" y "Oye Alfred" se miden por separado.
- **Éxito confirmado por estado.** Una acción cuenta como exitosa cuando el dispositivo reporta el estado nuevo, no cuando se envió el comando.
- **Origen de cada respuesta.** Regla, Claude, Ollama o ninguno, con su tasa de caída al respaldo.
- **Consumo del plan.** Llamadas diarias a `claude -p`, para no agotar el límite compartido con el uso normal.
- **Supervivencia del servicio.** Reinicios por día y minutos sin escuchar.
- **Temperatura de batería.** El teléfono vive enchufado; sobre 40 °C sostenidos hay que bajar carga o brillo.
