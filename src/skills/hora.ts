// Respuesta de la hora en español de Chile, para leerla en voz alta.
// Fase 1 solo necesita "¿qué hora es?" (criterio de salida); el motor de intenciones llega en la fase 2.

export function decirHora(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const verbo = h12 === 1 ? 'Es la' : 'Son las';
  const minutos = m === 0 ? 'en punto' : m === 15 ? 'y cuarto' : m === 30 ? 'y media' : `y ${m}`;
  return `${verbo} ${h12} ${minutos} ${periodo(h)}.`;
}

function periodo(h: number): string {
  if (h < 6) return 'de la madrugada';
  if (h < 12) return 'de la mañana';
  if (h === 12) return 'del mediodía';
  if (h < 20) return 'de la tarde';
  return 'de la noche';
}

const PIDE_HORA = /\b(qu[eé]\s+hora|la\s+hora|hora\s+es)\b/i;

/** Detecta si el comando pregunta la hora; tolera errores comunes de la transcripción ("¿ hora es"). */
export function pideHora(texto: string): boolean {
  return PIDE_HORA.test(texto.normalize('NFC'));
}
