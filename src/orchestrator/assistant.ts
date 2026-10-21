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

/** Apple Music y volumen en el teléfono (ADR-008); el audio sale por el Echo si está conectado por Bluetooth. */
export interface MusicPlayer {
  /** Con query busca y reproduce; sin query reanuda. false si Apple Music no respondió. */
  play(query?: string): Promise<boolean>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  /** Devuelve el volumen resultante, 0–100. */
  volume(change: {by: 'up' | 'down'} | {percent: number}): Promise<number>;
  nowPlaying(): Promise<{title: string; artist: string} | null>;
  /** Nombre del parlante Bluetooth conectado, o null si suena en el teléfono. */
  speaker(): Promise<string | null>;
}

export const NOT_UNDERSTOOD = 'No te entendí bien. Puedo decirte la hora o la fecha, poner temporizadores y recordatorios.';
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
        return {say: `Listo, temporizador de ${duracionFrase(slots.seconds!)}.`};
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
        return {say: timers.length === 1 ? 'Temporizador cancelado.' : `Cancelé ${timers.length} temporizadores.`};
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
        const ok = await music.play(slots.query);
        if (!ok) return {say: slots.query ? `No pude poner ${slots.query} en Apple Music.` : 'No pude retomar la música en Apple Music.'};
        const where = (await music.speaker()) ? '' : ' El Echo no está conectado, así que suena en el teléfono.';
        return {say: slots.query ? `Pongo ${slots.query}.${where}` : where.trim()};
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
      case 'volumen.subir': return {say: `Volumen al ${await music.volume({by: 'up'})} %.`};
      case 'volumen.bajar': return {say: `Volumen al ${await music.volume({by: 'down'})} %.`};
      default: return {say: `Volumen al ${await music.volume({percent: slots.percent ?? 50})} %.`};
    }
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
    return {say: kind === 'alarm' ? `Listo, alarma para ${cuando}.` : `Listo, te recuerdo ${cuando}: ${text}.`};
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
        return {say: 'Listo, borré todos tus recordatorios.'};
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
      return {say: `Listo, borré el recordatorio de ${this.describe(matches[0])}.`};
    }
    if (matches.length === 1) {
      return this.ask(`¿Borro el recordatorio de ${this.describe(matches[0])}?`, async answer => {
        if (!YES.test(normalize(answer))) return null;
        await this.store.remove(matches[0].id);
        return {say: 'Listo, lo borré.'};
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
      return {say: `Listo, borré el de ${this.describe(chosen)}.`};
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
