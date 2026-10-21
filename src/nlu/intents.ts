import {normalize} from './normalize';
import {defaultDate, isoDate, parseDuration, parseWhen} from './when';

// Motor de intenciones por reglas (ADR-006): texto → {intent, slots}. Lo que no calza es "desconocido";
// en la fase 5 eso irá al LLM. Medido con eval/nlu.jsonl (src/nlu/__tests__/eval.test.ts).

export type Slots = {
  date?: string;
  time?: string;
  seconds?: number;
  text?: string;
  range?: 'all' | 'today' | 'tomorrow' | 'week' | 'month';
  all?: boolean;
};
export type Intent = {intent: IntentName; slots: Slots};
export type IntentName =
  | 'hora' | 'fecha'
  | 'temporizador.crear' | 'temporizador.consultar' | 'temporizador.cancelar'
  | 'recordatorio.crear' | 'recordatorio.listar' | 'recordatorio.borrar'
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
    if (when.date) slots.date = when.date;
    if (when.time) {
      slots.time = when.time;
      if (!slots.date) slots.date = defaultDate(when.time, now);
    }
    return {intent: 'recordatorio.crear', slots};
  }

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
