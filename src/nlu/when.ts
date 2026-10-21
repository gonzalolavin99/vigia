// Fechas, horas y duraciones en español sobre texto ya normalizado (normalize.ts: sin tildes, números en dígitos).
// Devuelve lo encontrado y el texto sin esas expresiones, para extraer de qué trata un recordatorio.

export type When = {
  /** YYYY-MM-DD */
  date?: string;
  /** HH:MM, 24 h */
  time?: string;
  /** El texto sin las expresiones de fecha y hora. */
  rest: string;
};

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

const UNIT_SECONDS: Record<string, number> = {segundo: 1, minuto: 60, hora: 3600};

/** Duración total en segundos: "1 hora y 15 minutos", "media hora", "30 segundos". */
export function parseDuration(text: string): number | undefined {
  let total = 0;
  let found = false;
  const re = /\b(\d+|media)\s+(segundo|minuto|hora)s?\b(\s+y\s+media)?/g;
  for (const m of text.matchAll(re)) {
    const unit = UNIT_SECONDS[m[2]];
    total += m[1] === 'media' ? unit / 2 : Number(m[1]) * unit;
    if (m[3]) total += unit / 2;
    found = true;
  }
  return found ? total : undefined;
}

type Options = {
  /** Despertador: "a las 6" es de la mañana. Si no, de 1 a 6 sin "de la…" se entiende de la tarde. */
  morningBias?: boolean;
};

export function parseWhen(text: string, now: Date, options: Options = {}): When {
  let rest = ` ${text} `;
  let date: Date | undefined;
  let time: {h: number; m: number} | undefined;
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = rest.match(re);
    if (m) rest = rest.replace(m[0], ' ');
    return m;
  };

  // En N unidades (más): "en 30 minutos", "en 1 mes mas", "para 10 minutos mas", "dentro de 2 semanas".
  const rel = take(/\s(?:en|dentro de|para)\s+(\d+)\s+(segundo|minuto|hora|dia|semana|mes|ano)(?:s|es)?(?:\s+mas)?\s/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    if (unit in UNIT_SECONDS) {
      const at = new Date(now.getTime() + n * UNIT_SECONDS[unit] * 1000);
      date = at;
      time = {h: at.getHours(), m: at.getMinutes()};
    } else if (unit === 'dia') date = addDays(now, n);
    else if (unit === 'semana') date = addDays(now, 7 * n);
    else if (unit === 'mes') date = new Date(now.getFullYear(), now.getMonth() + n, now.getDate());
    else date = new Date(now.getFullYear() + n, now.getMonth(), now.getDate());
  }

  // Fecha absoluta: "el 15 de diciembre (de 2027)"; si ya pasó este año, el próximo.
  const abs = take(new RegExp(`\\s(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS.join('|')})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\s`));
  if (abs) {
    const month = MONTHS.indexOf(abs[2]);
    let candidate = new Date(abs[3] ? Number(abs[3]) : now.getFullYear(), month, Number(abs[1]));
    if (!abs[3] && isoDate(candidate) < isoDate(now)) candidate = new Date(now.getFullYear() + 1, month, Number(abs[1]));
    date = candidate;
  }

  if (take(/\spasado\s+manana\s/)) date = addDays(now, 2);
  // "mañana" es fecha salvo en "de la mañana".
  if (/\s(?<!la\s)manana\s/.test(rest) && take(/\s(?<!la\s)manana\s/)) date = addDays(now, 1);
  if (take(/\shoy(?:\s+dia)?\s/)) date = date ?? now;

  const weekday = take(new RegExp(`\\s(?:el\\s+)?(${WEEKDAYS.join('|')})\\s`));
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    const ahead = (target - now.getDay() + 7) % 7 || 7;
    date = addDays(now, ahead);
  }

  // Hora: "a las 9 y media de la noche", "de las 5", "a la una", "al mediodia".
  if (take(/\s(?:al|a|del)\s+mediodia\s/)) time = {h: 12, m: 0};
  else if (take(/\s(?:a\s+la\s+)?medianoche\s/)) time = {h: 0, m: 0};
  else {
    const t = take(/\s(?:a|de|para)\s+las?\s+(\d{1,2}|una)(?:\s+y\s+(\d{1,2}|media|cuarto))?(?:\s+(de\s+la\s+manana|de\s+la\s+madrugada|de\s+la\s+tarde|de\s+la\s+noche|del\s+mediodia|en\s+punto|am|pm))?\s/);
    if (t) {
      let h = t[1] === 'una' ? 1 : Number(t[1]);
      const m = t[2] === 'media' ? 30 : t[2] === 'cuarto' ? 15 : t[2] ? Number(t[2]) : 0;
      const period = t[3] ?? '';
      if (/tarde|noche|pm/.test(period) && h < 12) h += 12;
      else if (/manana|madrugada|am/.test(period) && h === 12) h = 0;
      else if (!period && !options.morningBias && h >= 1 && h <= 6) h += 12;
      time = {h, m};
    }
  }

  const result: When = {rest: rest.replace(/\s+/g, ' ').trim()};
  if (date) result.date = isoDate(date);
  if (time) result.time = `${pad(time.h)}:${pad(time.m)}`;
  return result;
}

/** Fecha por defecto cuando solo hay hora: hoy si aún no pasa, si no mañana. */
export function defaultDate(time: string, now: Date): string {
  return time > isoTime(now) ? isoDate(now) : isoDate(addDays(now, 1));
}
