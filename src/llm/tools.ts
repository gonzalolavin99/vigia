import type {IntentName} from '../nlu/intents';

// Las skills que el LLM puede elegir (fase 5): son las mismas intenciones que entienden las reglas, así una frase
// ambigua termina ejecutando la misma skill (docs/arquitectura.md, "Contratos"). Los argumentos son los Slots.
export type ToolSpec = {name: IntentName; description: string; args?: Record<string, string>};

export const TOOLS: ToolSpec[] = [
  {name: 'hora', description: 'Decir la hora actual'},
  {name: 'fecha', description: 'Decir qué día es una fecha', args: {date: 'YYYY-MM-DD; hoy si no se dice'}},
  {name: 'clima', description: 'Temperatura y estado del tiempo afuera', args: {inside: 'true si pregunta por adentro'}},
  {name: 'temporizador.crear', description: 'Poner un temporizador', args: {seconds: 'duración en segundos'}},
  {name: 'temporizador.consultar', description: 'Cuánto le queda al temporizador'},
  {name: 'temporizador.cancelar', description: 'Cancelar el temporizador'},
  {name: 'recordatorio.crear', description: 'Crear un recordatorio o alarma', args: {text: 'de qué trata ("alarma" para despertar)', date: 'YYYY-MM-DD', time: 'HH:MM 24 h'}},
  {name: 'recordatorio.listar', description: 'Leer recordatorios', args: {range: 'all | today | tomorrow | week | month'}},
  {name: 'recordatorio.borrar', description: 'Borrar recordatorios', args: {text: 'de qué trata', date: 'YYYY-MM-DD', time: 'HH:MM', all: 'true para todos'}},
  {name: 'musica.reproducir', description: 'Poner música en Apple Music; sin query retoma lo último', args: {query: 'artista, canción o álbum, con el nombre bien escrito', focus: 'artist | song | album', artist: 'artista si se pidió una canción'}},
  {name: 'musica.pausar', description: 'Pausar la música'},
  {name: 'musica.continuar', description: 'Seguir con la música'},
  {name: 'musica.siguiente', description: 'Siguiente canción'},
  {name: 'musica.anterior', description: 'Canción anterior'},
  {name: 'musica.que_suena', description: 'Decir qué canción suena'},
  {name: 'volumen.subir', description: 'Subir el volumen de la música'},
  {name: 'volumen.bajar', description: 'Bajar el volumen de la música'},
  {name: 'volumen.fijar', description: 'Volumen de la música en un porcentaje', args: {percent: '0 a 100'}},
  {name: 'luz.encender', description: 'Prender luces', args: {target: 'cuáles, con las palabras de la casa (ej. "luz living", "las luces de la cocina", "todo")'}},
  {name: 'luz.apagar', description: 'Apagar luces', args: {target: 'cuáles (ej. "luz cocina", "todo")'}},
  {name: 'luz.brillo', description: 'Brillo de luces', args: {target: 'cuáles', percent: '10 a 100', by: 'up | down'}},
  {name: 'luz.tono', description: 'Tono de la luz blanca', args: {target: 'cuáles', tone: 'calida | neutra | fria'}},
  {name: 'tv.encender', description: 'Prender la tele'},
  {name: 'tv.apagar', description: 'Apagar la tele'},
  {name: 'tv.volumen', description: 'Subir o bajar el volumen de la tele', args: {by: 'up | down'}},
  {name: 'tv.silencio', description: 'Silenciar la tele'},
];
