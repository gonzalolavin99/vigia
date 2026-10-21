// Cómo se dicen fechas y horas en voz alta (español de Chile).
import {isoDate} from '../nlu/when';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Son las 9 y 51 de la noche." */
export function decirHora(date: Date): string {
  return `${horaFrase(date, true)}.`;
}

/** "las 9 y media de la noche" / "la 1 en punto de la tarde"; con verbo: "Son las …". */
export function horaFrase(date: Date, conVerbo = false): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const articulo = h12 === 1 ? 'la' : 'las';
  const minutos = m === 0 ? 'en punto' : m === 15 ? 'y cuarto' : m === 30 ? 'y media' : `y ${m}`;
  const frase = `${articulo} ${h12} ${minutos} ${periodo(h)}`;
  return conVerbo ? `${h12 === 1 ? 'Es' : 'Son'} ${frase}` : frase;
}

function periodo(h: number): string {
  if (h < 6) return 'de la madrugada';
  if (h < 12) return 'de la mañana';
  if (h === 12) return 'del mediodía';
  if (h < 20) return 'de la tarde';
  return 'de la noche';
}

/** "miércoles 21 de octubre" (+ " de 2027" si no es este año). */
export function fechaFrase(date: Date, now: Date): string {
  const year = date.getFullYear() === now.getFullYear() ? '' : ` de ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}${year}`;
}

/** "hoy", "mañana", "el viernes 23 de octubre". */
export function cuandoFrase(date: Date, now: Date): string {
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === 2) return 'pasado mañana';
  return `el ${fechaFrase(date, now)}`;
}

/** "10 minutos", "1 hora y 15 minutos", "30 segundos". */
export function duracionFrase(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  if (s && !h) parts.push(`${s} ${s === 1 ? 'segundo' : 'segundos'}`);
  return parts.length ? parts.join(' y ') : '0 segundos';
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Date local a partir de "YYYY-MM-DD" y "HH:MM". */
export function toDate(date: string, time = '00:00'): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

export {isoDate};
