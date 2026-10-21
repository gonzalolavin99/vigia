import {normalize} from './normalize';
import {defaultDate, isoDate, parseDuration, parseWhen} from './when';

// Motor de intenciones por reglas (ADR-006): texto → {intent, slots}. Lo que no calza es "desconocido";
// en la fase 5 eso irá al LLM. Medido con eval/nlu.jsonl (src/nlu/__tests__/eval.test.ts).

export type Slots = {
  date?: string;
  time?: string;
  seconds?: number;
  text?: string;
  /** El mismo texto tal como se dijo (con tildes y ñ), para guardarlo y leerlo en voz alta. */
  label?: string;
  range?: 'all' | 'today' | 'tomorrow' | 'week' | 'month';
  all?: boolean;
  /** Qué poner en Apple Music ("queen", "bohemian rhapsody"). */
  query?: string;
  /** Si la búsqueda es de un artista, una canción o un álbum (se le pasa a Apple Music). */
  focus?: 'artist' | 'song' | 'album';
  /** Artista de una canción pedida como "la canción X de Y". */
  artist?: string;
  /** Volumen pedido, 0–100. */
  percent?: number;
};
export type Intent = {intent: IntentName; slots: Slots};
export type IntentName =
  | 'hora' | 'fecha'
  | 'temporizador.crear' | 'temporizador.consultar' | 'temporizador.cancelar'
  | 'recordatorio.crear' | 'recordatorio.listar' | 'recordatorio.borrar'
  | 'musica.reproducir' | 'musica.pausar' | 'musica.continuar' | 'musica.siguiente' | 'musica.anterior' | 'musica.que_suena'
  | 'volumen.subir' | 'volumen.bajar' | 'volumen.fijar'
  | 'desconocido';

const REMIND = /\b(recuerdame|recordarme|me recuerdas|ponme un recordatorio|pon un recordatorio|crea un recordatorio|avisame que|despiertame|despertame)\b/;
const ALARM_AT = /\b(pon|ponme|poner|programa|programar|crea|crear)\s+(una\s+)?alarma\b/;
const TIMER = /\b(temporizador|timer|cuenta regresiva)\b/;
const DELETE = /\b(borra|borrar|elimina|eliminar|quita|quitar|cancela|cancelar|saca)\b/;
const LIST = /\b(recordatorios?|alarmas?)\b/;
// Muletillas al inicio que no son parte del pedido.
const FILLERS = /^((oye|hola|alfred|ey|eh|por favor|porfa)\s+)+/;
// Palabras de enlace que sobran al inicio de lo que trata un recordatorio.
const LEADING = /^((un|una|recordatorios?|alarmas?|para|de|del|que|el|la|los|las|a|al|me|puedes|poner|podrias|est[ea]s?|es[ea]s?)\s+)+/;
// Confusiones reales de NeMo al oír "¿qué hora es?" con ruido o lejos (fase 1, 20–21 oct).
const HORA_CONFUSIONS = /^(que era es|queera es|quien es|que crees|usted que es|what s it|whats it|hora es)$/;


export function parseIntent(raw: string, now: Date): Intent {
  const text = normalize(raw).replace(FILLERS, '');

  // Temporizador: "pon un timer de 5 minutos", "alarma para 10 minutos mas", "avisame en 20 minutos".
  const seconds = parseDuration(text);
  if (TIMER.test(text) || (/\balarma\b/.test(text) && seconds !== undefined && /\bmas\b|\ben\b|\bpara\b/.test(text)) || (/\bavisame\s+en\b/.test(text) && seconds !== undefined)) {
    if (/\b(cuanto|queda|falta)\b/.test(text)) return {intent: 'temporizador.consultar', slots: {}};
    if (/\b(cancela|para|deten|apaga|quita|borra)\b/.test(text) && seconds === undefined) return {intent: 'temporizador.cancelar', slots: {}};
    if (seconds !== undefined) return {intent: 'temporizador.crear', slots: {seconds}};
  }
  if (/^(cuanto (le )?(queda|falta)|cuanto queda del?)\b/.test(text)) return {intent: 'temporizador.consultar', slots: {}};
  if (/\b(apaga|para|deten)\s+(la\s+)?alarma\b/.test(text) && !/\bde\b/.test(text)) return {intent: 'temporizador.cancelar', slots: {}};

  // Borrar recordatorio: "borra el de las 5", "elimina el recordatorio de mañana", "borra todos".
  if (DELETE.test(text) && (LIST.test(text) || /\b(el|la)\s+de\b/.test(text) || /\b(este|esta|ese|esa)\b/.test(text))) {
    if (/\btod[oa]s\b/.test(text)) return {intent: 'recordatorio.borrar', slots: {all: true}};
    const when = parseWhen(text, now);
    const slots: Slots = {};
    if (when.date) slots.date = when.date;
    if (when.time) slots.time = when.time;
    const about = `${when.rest.replace(DELETE, ' ').replace(/\s+/g, ' ').trim()} `.replace(LEADING, '').trim();
    if (about) slots.text = about;
    return {intent: 'recordatorio.borrar', slots};
  }

  // Listar: "¿qué recordatorios tengo?", "¿qué tengo para mañana?", "mis recordatorios de este mes".
  if ((LIST.test(text) && /\b(que|cuales|tengo|dime|lee|mis|hay|alguna|algun)\b/.test(text) && !REMIND.test(text) && !ALARM_AT.test(text))
    || /^que tengo\b/.test(text)) {
    let range: Slots['range'] = 'all';
    if (/\b(este|del)\s+mes\b/.test(text)) range = 'month';
    else if (/\b(esta|la)\s+semana\b/.test(text)) range = 'week';
    else if (/\bpasado manana\b/.test(text)) range = 'all';
    else if (/(?<!la )\bmanana\b/.test(text)) range = 'tomorrow';
    else if (/\bhoy\b/.test(text)) range = 'today';
    return {intent: 'recordatorio.listar', slots: {range}};
  }

  // Crear recordatorio o alarma a una hora: "recuérdame mañana a las 9 llamar a Felipe", "pon una alarma mañana a las 7".
  if (REMIND.test(text) || ALARM_AT.test(text)) {
    const isAlarm = ALARM_AT.test(text) || /\bdespiertame|despertame\b/.test(text);
    const when = parseWhen(text, now, {morningBias: isAlarm});
    const slots: Slots = {};
    const about = `${when.rest.replace(REMIND, ' ').replace(ALARM_AT, ' ').replace(/\s+/g, ' ').trim()} `.replace(LEADING, '').trim();
    slots.text = isAlarm || !about ? 'alarma' : about;
    if (slots.text !== 'alarma') slots.label = original(raw, about);
    if (when.date) slots.date = when.date;
    if (when.time) {
      slots.time = when.time;
      if (!slots.date) slots.date = defaultDate(when.time, now);
    }
    return {intent: 'recordatorio.crear', slots};
  }

  // Música y volumen (fase 3, ADR-008). Van después de temporizadores y recordatorios: "pon una alarma" no es música.
  const music = parseMusic(text);
  if (music) return music;

  // Fecha: "¿qué día es hoy?", "¿a cuánto estamos mañana?", "¿qué día es el 20 de noviembre?".
  if (/\b(que|en que)\s+(dia|dias|fecha)\b|\ba cuanto estamos\b|\bque dia cae\b/.test(text) || /^(manana|hoy|pasado manana) que dias?$/.test(text)) {
    const when = parseWhen(text, now);
    return {intent: 'fecha', slots: {date: when.date ?? isoDate(now)}};
  }

  // Hora: "¿qué hora es?", "dime la hora", "What time is it?" y confusiones frecuentes de la transcripción.
  if (/\b(que hora|la hora|hora es|hora tienes)\b|\bwhat time\b/.test(text) || HORA_CONFUSIONS.test(text)) {
    return {intent: 'hora', slots: {}};
  }

  return {intent: 'desconocido', slots: {}};
}

/**
 * Recupera del texto original las palabras que corresponden a `normalized` ("viajo a espana" → "viajo a España"),
 * para no perder tildes ni ñ al guardar y leer el recordatorio. Si no las ubica, devuelve `normalized`.
 */
export function original(raw: string, normalized: string): string {
  const want = normalized.split(' ');
  const words = raw.split(/\s+/).filter(Boolean);
  const norm = words.map(w => normalize(w));
  for (let start = 0; start < words.length; start++) {
    let i = start;
    let k = 0;
    // Una palabra original puede normalizarse a varias ("9:30" → "9 y 30") o a ninguna ("¿").
    while (i < words.length && k < want.length) {
      const parts = norm[i] ? norm[i].split(' ') : [];
      if (parts.length && parts.every((p, j) => want[k + j] === p)) { k += parts.length; i++; }
      else if (!parts.length && k > 0) i++;
      else break;
    }
    if (k === want.length) return words.slice(start, i).join(' ').replace(/^[¿¡"'(]+|[?!.,;:"')]+$/g, '');
  }
  return normalized;
}

const PLAY_VERB = /\b(pon|ponme|poner|pones|reproduce|reproducir|reproduceme|toca|tocar|escuchar)\b/;
// Lo que sobra entre el verbo y lo que se quiere escuchar: "pon música de Queen" → "queen".
const QUERY_LEADING = /^((me|te|puedes|podrias|quiero|un|poco|algo|musica|canciones|cancion|una|el|la|los|las|album|disco|de|del|tema)\s+)+/;

/** Música y volumen: "pon Queen", "pausa", "siguiente", "sube el volumen", "volumen al 50", "¿qué canción es esta?". */
function parseMusic(text: string): Intent | null {
  if (/\b(que (cancion|tema) es (esta|esto|este)|que (esta|estas) sonando|que suena|como se llama (esta|la|el) (cancion|tema)|quien canta)\b/.test(text)) {
    return {intent: 'musica.que_suena', slots: {}};
  }
  if (/\bvolumen\b|\bmas (fuerte|alto|bajo|bajito|despacio|suave)\b/.test(text)) {
    const number = text.match(/\b(\d{1,3})\b/);
    if (number) return {intent: 'volumen.fijar', slots: {percent: Math.min(100, Number(number[1]))}};
    if (/\bmitad\b/.test(text)) return {intent: 'volumen.fijar', slots: {percent: 50}};
    if (/\bmaximo\b/.test(text)) return {intent: 'volumen.fijar', slots: {percent: 100}};
    if (/\bminimo\b/.test(text)) return {intent: 'volumen.fijar', slots: {percent: 10}};
    if (/\b(baja|bajar|bajale|disminuye|mas bajo|bajito|despacio|suave)\b/.test(text)) return {intent: 'volumen.bajar', slots: {}};
    if (/\b(sube|subir|subele|aumenta|mas fuerte|mas alto)\b/.test(text)) return {intent: 'volumen.subir', slots: {}};
  }
  if (/^anterior$|\b(cancion anterior|tema anterior|la (cancion )?de antes|vuelve a la (cancion )?anterior)\b/.test(text)) {
    return {intent: 'musica.anterior', slots: {}};
  }
  if (/^siguiente$|\b(siguiente (cancion|tema)|salta(te)? (esta|la|este)|otra cancion|cambia (la|de) cancion|pasa (a la siguiente|la cancion))\b/.test(text)) {
    return {intent: 'musica.siguiente', slots: {}};
  }
  if (/^(pausa|pausar)$/.test(text) || /\b(pausa|pausar|pausale|deten|detener|para|parar|apaga|silencia)\s+(la\s+)?(musica|cancion|tema)\b/.test(text)) {
    return {intent: 'musica.pausar', slots: {}};
  }
  if (/^(sigue|continua|reanuda|play|dale play)$/.test(text) || /\b(sigue|continua|reanuda|vuelve a poner)\s+(con\s+)?(la\s+)?(musica|cancion|tema)\b/.test(text)) {
    return {intent: 'musica.continuar', slots: {}};
  }
  const verb = text.match(PLAY_VERB);
  if (verb) {
    // Qué tipo de cosa se pide: Apple Music confunde artista y canción si no se le dice (22 oct: "a queen").
    const rest = text.slice(verb.index! + verb[0].length).replace(/^\s*(me|te|puedes|podrias|quiero)\s+/, '').trim();
    const album = rest.match(/^(el\s+|un\s+)?(album|disco)\s+(.+)$/);
    if (album) return {intent: 'musica.reproducir', slots: {query: album[3], focus: 'album'}};
    const song = rest.match(/^(la\s+)?(cancion|tema)\s+(.+)$/);
    if (song) {
      const byArtist = song[3].match(/^(.+)\s+de\s+(.+)$/);
      return {intent: 'musica.reproducir', slots: byArtist ? {query: byArtist[1], artist: byArtist[2], focus: 'song'} : {query: song[3], focus: 'song'}};
    }
    const artist = rest.match(/^(a\s+|al\s+)?(un poco de|algo de|musica de|canciones de|temas de|a)\s+(.+)$/);
    if (artist) return {intent: 'musica.reproducir', slots: {query: artist[3], focus: 'artist'}};
    const query = `${rest} `.replace(QUERY_LEADING, '').trim();
    return {intent: 'musica.reproducir', slots: query ? {query} : {}};
  }
  return null;
}
