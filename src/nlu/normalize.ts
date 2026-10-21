// Normalizador del texto que entrega NeMo (fase 2, ADR-006): minúsculas, sin tildes ni signos, y números en
// palabras convertidos a dígitos ("diez minutos" → "10 minutos", "veinticinco" → "25").

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, primero: 1,
};
const TENS: Record<string, number> = {treinta: 30, cuarenta: 40, cincuenta: 50};
// "un", "una" y "primero" son números solo antes de una unidad de tiempo o de "de <mes>"; si no, son artículos.
const ARTICLE_LIKE = new Set(['un', 'una', 'uno', 'primero']);
const COUNTABLE = /^(segundos?|minutos?|horas?|dias?|semanas?|mes(es)?|ano|anos|de)$/;

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalize(text: string): string {
  const words = stripAccents(text.toLowerCase())
    .replace(/(\d+):(\d{2})/g, '$1 y $2') // "9:30" → "9 y 30"
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in TENS) {
      // "treinta y cinco" → 35
      const unit = words[i + 1] === 'y' ? UNITS[words[i + 2]] : undefined;
      if (unit !== undefined && unit > 0 && unit < 10) { out.push(String(TENS[w] + unit)); i += 2; }
      else out.push(String(TENS[w]));
      continue;
    }
    if (w in UNITS && !(ARTICLE_LIKE.has(w) && !COUNTABLE.test(words[i + 1] ?? ''))) {
      out.push(String(UNITS[w]));
      continue;
    }
    out.push(w);
  }
  return out.join(' ');
}
