import {DeviceError} from '../devices/types';
import {describeLights, Home} from '../devices/home';
import {correctArtist, SEED_ARTISTS} from '../nlu/artists';
import {Intent, parseIntent} from '../nlu/intents';
import {normalize} from '../nlu/normalize';
import {addDays, defaultDate, isoDate, parseWhen} from '../nlu/when';
import {cuandoFrase, decirHora, duracionFrase, fechaFrase, horaFrase, toDate} from '../skills/say';
import type {Reply} from './machine';

// Skills de la fase 2 (hora, fecha, temporizador, recordatorios) y el diálogo cuando falta un dato:
// si a un recordatorio le falta la hora, pregunta "¿A qué hora?" y la siguiente frase se interpreta como respuesta.

export type ReminderKind = 'reminder' | 'alarm' | 'timer';
export type Reminder = {id: number; text: string; at: number; kind: ReminderKind};

/** Recordatorios guardados en el teléfono (SQLite + alarmas exactas en Android, ADR-009). */
export interface ReminderStore {
  add(reminder: Omit<Reminder, 'id'>): Promise<Reminder>;
  /** Solo los pendientes, ordenados por hora. */
  list(): Promise<Reminder[]>;
  remove(id: number): Promise<void>;
}

export type MusicSearch = {query: string; focus?: 'artist' | 'song' | 'album'; artist?: string};

/** Apple Music y volumen en el teléfono (ADR-008); el audio sale por el Echo si está conectado por Bluetooth. */
export interface MusicPlayer {
  /** Con búsqueda la reproduce; sin ella reanuda. false si Apple Music no respondió. */
  play(search?: MusicSearch): Promise<boolean>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  /** Devuelve el volumen resultante, 0–100. */
  volume(change: {by: 'up' | 'down'} | {percent: number}): Promise<number>;
  nowPlaying(): Promise<{title: string; artist: string} | null>;
  /** Nombre del parlante Bluetooth conectado, o null si suena en el teléfono. */
  speaker(): Promise<string | null>;
  /** Artistas que ya sonaron en Apple Music (para corregir nombres en inglés mal transcritos). */
  knownArtists(): Promise<string[]>;
  rememberArtist(name: string): void;
}

export const NOT_UNDERSTOOD = 'No te entendí bien. Puedo decirte la hora, la fecha y el clima, poner temporizadores, recordatorios y música, y manejar las luces y la tele.';
const MAX_READ = 5;
const YES = /^(si|sí|claro|dale|ya|ok|okay|bueno|correcto|confirmo|hazlo|borralo|borralos)\b/;
const NO = /^(no|nada|cancela|olvidalo|dejalo|mejor no)\b/;
const ORDINALS: Record<string, number> = {primero: 1, primer: 1, '1': 1, segundo: 2, '2': 2, tercero: 3, tercer: 3, '3': 3, cuarto: 4, '4': 4, quinto: 5, '5': 5};

type FollowUp = (text: string) => Promise<Reply | null>;

export class Assistant {
  private pending: FollowUp | null = null;

  constructor(
    private readonly store: ReminderStore,
    private readonly now: () => Date = () => new Date(),
    private readonly music: MusicPlayer | null = null,
    /** La casa (luces, TV, clima) se carga de home.json; null si aún no hay configuración. */
    private readonly home: () => Promise<Home | null> = async () => null,
  ) {}

  async resolve(text: string): Promise<Reply> {
    const followUp = this.pending;
    this.pending = null;
    if (followUp) {
      if (NO.test(normalize(text))) return {say: 'Listo, no hago nada.'};
      const reply = await followUp(text);
      if (reply) return reply;
      // La respuesta no sirvió para la pregunta: se trata como un pedido nuevo.
    }
    return this.handle(parseIntent(text, this.now()));
  }

  private ask(question: string, followUp: FollowUp): Reply {
    this.pending = followUp;
    return {say: question, expectReply: true};
  }

  private async handle({intent, slots}: Intent): Promise<Reply> {
    const now = this.now();
    switch (intent) {
      case 'hora':
        return {say: decirHora(now)};

      case 'fecha': {
        const date = toDate(slots.date!);
        const when = cuandoFrase(date, now);
        if (when === 'hoy') return {say: `Hoy es ${fechaFrase(date, now)}.`};
        if (when === 'mañana' || when === 'pasado mañana') return {say: `${capitalize(when)} es ${fechaFrase(date, now)}.`};
        // "¿Qué día es el 20 de noviembre?" → "El 20 de noviembre es viernes."
        const [weekday, ...dayMonth] = fechaFrase(date, now).split(' ');
        return {say: `El ${dayMonth.join(' ')} es ${weekday}.`};
      }

      case 'temporizador.crear': {
        await this.store.add({text: 'temporizador', at: now.getTime() + slots.seconds! * 1000, kind: 'timer'});
        return done(`Temporizador de ${duracionFrase(slots.seconds!)}.`);
      }

      case 'temporizador.consultar': {
        const timer = (await this.store.list()).find(r => r.kind === 'timer');
        if (!timer) return {say: 'No tienes temporizadores corriendo.'};
        return {say: `Quedan ${duracionFrase(Math.max(0, (timer.at - now.getTime()) / 1000))}.`};
      }

      case 'temporizador.cancelar': {
        const timers = (await this.store.list()).filter(r => r.kind === 'timer');
        if (!timers.length) return {say: 'No tienes temporizadores corriendo.'};
        await Promise.all(timers.map(t => this.store.remove(t.id)));
        return done(timers.length === 1 ? 'Temporizador cancelado.' : `Cancelé ${timers.length} temporizadores.`);
      }

      case 'recordatorio.crear':
        return this.createReminder(slots.label ?? slots.text ?? 'alarma', slots.date, slots.time);

      case 'recordatorio.listar':
        return this.listReminders(slots.range ?? 'all');

      case 'recordatorio.borrar':
        return this.deleteReminders(slots);

      case 'musica.reproducir':
      case 'musica.pausar':
      case 'musica.continuar':
      case 'musica.siguiente':
      case 'musica.anterior':
      case 'musica.que_suena':
      case 'volumen.subir':
      case 'volumen.bajar':
      case 'volumen.fijar':
        return this.handleMusic(intent, slots);

      case 'luz.encender':
      case 'luz.apagar':
      case 'luz.brillo':
      case 'luz.tono':
        return this.handleLights(intent, slots);

      case 'tv.encender':
      case 'tv.apagar':
      case 'tv.volumen':
      case 'tv.silencio':
      case 'tv.conectar':
        return this.handleTv(intent, slots);

      case 'clima':
        return this.handleWeather(slots.inside === true);

      default:
        return {say: NOT_UNDERSTOOD};
    }
  }

  // Pausa, sigue, siguiente y anterior actúan sin hablar para no interrumpir la música (say vacío).
  private async handleMusic(intent: Intent['intent'], slots: Intent['slots']): Promise<Reply> {
    const music = this.music;
    if (!music) return {say: 'La música todavía no está disponible.'};
    switch (intent) {
      case 'musica.reproducir': {
        // Nombres en inglés que NeMo escribe como suenan ("Machine Ganchelli") se corrigen al artista conocido más parecido.
        const known = [...new Set([...(await music.knownArtists()), ...SEED_ARTISTS])];
        const corrected = slots.query && slots.focus !== 'song' && slots.focus !== 'album'
          ? correctArtist(slots.query, known, slots.focus === 'artist') : null;
        const search = corrected ? {query: corrected, focus: 'artist' as const}
          : slots.query ? {query: slots.query, focus: slots.focus, artist: slots.artist} : undefined;
        const ok = await music.play(search);
        if (!ok) return {say: slots.query ? `No pude poner ${slots.query} en Apple Music.` : 'No pude retomar la música en Apple Music.'};
        const where = (await music.speaker()) ? '' : ' El Echo no está conectado, así que suena en el teléfono.';
        // En pantalla queda lo que de verdad sonó: si Apple Music entendió otra cosa, se nota (22 oct: "Killer Queen").
        const song = await music.nowPlaying();
        if (song) music.rememberArtist(song.artist);
        const playing = song ? `Sonando: ${song.title}, de ${song.artist}.` : 'Sonando en Apple Music.';
        if (!slots.query && !where) return {say: '', show: playing};
        return {say: `Listo.${where}`, show: `${playing}${where}`};
      }
      case 'musica.pausar': await music.pause(); return {say: ''};
      case 'musica.continuar': {
        const ok = await music.play();
        return {say: ok ? '' : 'No pude retomar la música en Apple Music.'};
      }
      case 'musica.siguiente': await music.next(); return {say: ''};
      case 'musica.anterior': await music.previous(); return {say: ''};
      case 'musica.que_suena': {
        const song = await music.nowPlaying();
        return {say: song ? `Es ${song.title}, de ${song.artist}.` : 'No está sonando nada en Apple Music.'};
      }
      case 'volumen.subir': return done(`Volumen al ${await music.volume({by: 'up'})} %.`);
      case 'volumen.bajar': return done(`Volumen al ${await music.volume({by: 'down'})} %.`);
      default: return done(`Volumen al ${await music.volume({percent: slots.percent ?? 50})} %.`);
    }
  }

  private async handleLights(intent: Intent['intent'], slots: Intent['slots']): Promise<Reply> {
    const home = await this.home();
    if (!home || !home.allLights.length) return {say: 'Todavía no tengo luces configuradas.'};
    const devices = home.resolveLights(slots.target);
    if (devices === null) return {say: `No conozco ${slots.target ? `"${slots.target}"` : 'esa luz'}.`};
    if (!devices.length) {
      const options = home.allLights.map(d => d.name.replace(/^luz\s+/, '')).join(', ');
      return this.ask(`¿Cuál luz? Tengo ${options}.`, async answer => {
        if (!home.resolveLights(answer)) return null;
        return this.handleLights(intent, {...slots, target: answer});
      });
    }
    const what = describeLights(devices, home.allLights);
    let outcome;
    let done: string;
    if (intent === 'luz.encender' || intent === 'luz.apagar') {
      const on = intent === 'luz.encender';
      outcome = await home.setLights(devices, (a, d) => a.setPower(d, on));
      done = `${on ? 'Prendí' : 'Apagué'} ${what}.`;
    } else if (intent === 'luz.tono') {
      const kelvin = {calida: 2700, neutra: 4000, fria: 6500}[slots.tone ?? 'neutra'];
      outcome = await home.setLights(devices, (a, d) => a.setWhite(d, kelvin));
      done = `Luz ${slots.tone === 'fria' ? 'fría' : slots.tone === 'calida' ? 'cálida' : 'neutra'} en ${what}.`;
    } else {
      let percent = slots.percent;
      if (percent === undefined) {
        // Subir o bajar: 30 puntos desde el brillo actual de la primera luz.
        const current = await brightnessOf(home, devices[0]);
        percent = Math.min(100, Math.max(10, (current ?? 60) + (slots.by === 'down' ? -30 : 30)));
      }
      const target = percent;
      outcome = await home.setLights(devices, (a, d) => a.setBrightness(d, target));
      done = `${capitalize(what)} al ${target} %.`;
    }
    if (!outcome.failed.length) return {say: 'Listo.', show: done};
    const failedNames = outcome.failed.map(e => e.device.name).join(', ');
    return {say: outcome.done.length ? `${done.replace(/\.$/, '')}, pero no pude con ${failedNames}.` : `No pude comunicarme con ${failedNames}. ¿Está conectada a la red?`};
  }

  private async handleTv(intent: Intent['intent'], slots: Intent['slots']): Promise<Reply> {
    const home = await this.home();
    if (!home?.television) return {say: 'Todavía no tengo la tele configurada.'};
    try {
      if (intent === 'tv.encender') { await home.tvPower(true); return done('Prendí la tele.'); }
      if (intent === 'tv.apagar') { await home.tvPower(false); return done('Apagué la tele.'); }
      if (intent === 'tv.silencio') { await home.tvKey('KEY_MUTE'); return {say: ''}; }
      if (intent === 'tv.conectar') { await home.tvPair(); return done('Conectado con la tele.'); }
      await home.tvKey(slots.by === 'down' ? 'KEY_VOLDOWN' : 'KEY_VOLUP', 3);
      return {say: ''};
    } catch (error) {
      if (error instanceof DeviceError && error.reason === 'unpaired') {
        return {say: 'Primero tengo que conectarme con la tele. Préndela con el control y dime: Alfred, conecta la tele.'};
      }
      if (error instanceof DeviceError && error.reason === 'unreachable' && intent === 'tv.conectar') {
        return {say: 'La tele tiene que estar prendida para conectarme. Préndela con el control y vuelve a pedírmelo.'};
      }
      if (error instanceof DeviceError && error.reason === 'unauthorized') return {say: 'La tele no me dio permiso. Acepta el aviso de Vigía en la pantalla de la tele y vuelve a pedírmelo.'};
      if (error instanceof DeviceError && error.reason === 'unreachable') {
        return {say: intent === 'tv.encender'
          ? 'No logré encender la tele. Revisa que esté activado "Encender con el móvil" en sus ajustes de red.'
          : 'La tele no responde; parece estar apagada.'};
      }
      return {say: 'No pude comunicarme con la tele.'};
    }
  }

  private async handleWeather(inside: boolean): Promise<Reply> {
    const home = await this.home();
    const weather = home ? await home.weather.current() : null;
    if (!weather) return {say: 'No pude obtener el clima. ¿Hay internet?'};
    const degrees = Math.round(weather.temperature);
    const state = weather.description ? ` y está ${weather.description}` : '';
    const prefix = inside ? 'No tengo un sensor adentro. ' : '';
    return {say: `${prefix}Afuera hay ${degrees} ${Math.abs(degrees) === 1 ? 'grado' : 'grados'}${state}.`};
  }

  private async createReminder(text: string, date: string | undefined, time: string | undefined): Promise<Reply> {
    const kind: ReminderKind = text === 'alarma' ? 'alarm' : 'reminder';
    if (!date && !time) {
      return this.ask('¿Para cuándo?', async answer => {
        const when = parseWhen(normalize(answer), this.now(), {morningBias: kind === 'alarm'});
        if (!when.date && !when.time) return null;
        return this.createReminder(text, when.date ?? (when.time ? defaultDate(when.time, this.now()) : undefined), when.time);
      });
    }
    if (!time) {
      return this.ask('¿A qué hora?', async answer => {
        let spoken = normalize(answer);
        if (!/\b(a|de|para)\s+las?\b|mediodia|medianoche/.test(spoken)) spoken = `a las ${spoken}`;
        const when = parseWhen(spoken, this.now(), {morningBias: kind === 'alarm'});
        if (!when.time) return null;
        // "A las doce de la noche" del día pedido es la medianoche siguiente.
        const day = date && when.nextDay ? isoDate(addDays(toDate(date), 1)) : date;
        return this.createReminder(text, day, when.time);
      });
    }
    const at = toDate(date ?? defaultDate(time, this.now()), time);
    if (at.getTime() <= this.now().getTime()) return {say: 'Esa hora ya pasó. ¿Me lo repites con otra hora?'};
    await this.store.add({text, at: at.getTime(), kind});
    const cuando = `${cuandoFrase(at, this.now())} a ${horaFrase(at)}`;
    // Se dice solo cuándo (una hora mal entendida cuesta caro); el texto completo queda en pantalla.
    return {say: `Listo, ${cuando}.`, show: kind === 'alarm' ? `Alarma para ${cuando}.` : `Te recuerdo ${cuando}: ${text}.`};
  }

  private async listReminders(range: 'all' | 'today' | 'tomorrow' | 'week' | 'month'): Promise<Reply> {
    const now = this.now();
    const inRange = (await this.store.list()).filter(r => r.kind !== 'timer' && within(new Date(r.at), range, now));
    const scope = {all: '', today: ' para hoy', tomorrow: ' para mañana', week: ' esta semana', month: ' este mes'}[range];
    if (!inRange.length) return {say: `No tienes recordatorios${scope}.`};
    const items = inRange.slice(0, MAX_READ).map(r => this.describe(r)).join('; ');
    const more = inRange.length > MAX_READ ? `; y ${inRange.length - MAX_READ} más` : '';
    return {say: `Tienes ${inRange.length} ${inRange.length === 1 ? 'recordatorio' : 'recordatorios'}${scope}: ${items}${more}.`};
  }

  private async deleteReminders(slots: Intent['slots']): Promise<Reply> {
    const all = (await this.store.list()).filter(r => r.kind !== 'timer');
    if (!all.length) return {say: 'No tienes recordatorios.'};
    if (slots.all) {
      return this.ask(`¿Borro tus ${all.length} recordatorios?`, async answer => {
        if (!YES.test(normalize(answer))) return null;
        await Promise.all(all.map(r => this.store.remove(r.id)));
        return done('Borré todos tus recordatorios.');
      });
    }
    const matches = all.filter(r => {
      const at = new Date(r.at);
      if (slots.date && isoDay(at) !== slots.date) return false;
      if (slots.time && hhmm(at) !== slots.time) return false;
      if (slots.text && !normalize(r.text).includes(normalize(slots.text))) return false;
      return true;
    });
    if (!matches.length) return {say: 'No encontré ese recordatorio.'};
    const specific = slots.date || slots.time || slots.text;
    if (matches.length === 1 && specific) {
      await this.store.remove(matches[0].id);
      return done(`Borré el recordatorio de ${this.describe(matches[0])}.`);
    }
    if (matches.length === 1) {
      return this.ask(`¿Borro el recordatorio de ${this.describe(matches[0])}?`, async answer => {
        if (!YES.test(normalize(answer))) return null;
        await this.store.remove(matches[0].id);
        return done('Lo borré.');
      });
    }
    const options = matches.slice(0, MAX_READ);
    const list = options.map((r, i) => `${['el primero', 'el segundo', 'el tercero', 'el cuarto', 'el quinto'][i]}, ${this.describe(r)}`).join('; ');
    return this.ask(`Tienes ${matches.length}. ¿Cuál borro? ${capitalize(list)}.`, async answer => {
      const spoken = normalize(answer);
      const ordinal = spoken.split(' ').map(w => ORDINALS[w]).find(Boolean);
      const chosen = ordinal ? options[ordinal - 1]
        : /\bultimo\b/.test(spoken) ? options[options.length - 1]
        : options.find(r => spoken.length > 3 && normalize(this.describe(r)).includes(spoken.replace(/^(el|la)\s+(de\s+)?/, '')));
      if (!chosen) return null;
      await this.store.remove(chosen.id);
      return done(`Borré el de ${this.describe(chosen)}.`);
    });
  }

  /** "mañana a las 9 en punto de la mañana, llamar a felipe". */
  private describe(r: Reminder): string {
    const at = new Date(r.at);
    const what = r.kind === 'alarm' ? 'alarma' : r.text;
    return `${cuandoFrase(at, this.now())} a ${horaFrase(at)}, ${what}`;
  }
}

function within(at: Date, range: string, now: Date): boolean {
  const days = Math.floor((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  if (range === 'today') return days === 0;
  if (range === 'tomorrow') return days === 1;
  if (range === 'week') return days >= 0 && days < 7;
  if (range === 'month') return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
  return true;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function brightnessOf(home: Home, device: Parameters<Home['setLights']>[0][number]): Promise<number | null> {
  let value: number | null = null;
  await home.setLights([device], async (adapter, d) => { value = await adapter.brightness(d); });
  return value;
}

/** Acción hecha: en voz solo "Listo."; el detalle queda en pantalla (pedido de Gonzalo, 26 oct). */
function done(detail: string): Reply {
  return {say: 'Listo.', show: detail};
}
