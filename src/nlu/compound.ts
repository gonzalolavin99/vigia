import {Intent, parseIntent} from './intents';

// Varias órdenes en una frase: "apaga la tele y las luces", "prende la luz del living y pon música".
// Cada parte sin verbo hereda el de la anterior ("y las luces" → "apaga las luces"). Solo se separa si cada parte
// es una orden y no todas son de la misma familia: "apaga la luz de la cocina y la del living" la entienden las
// reglas de luces de una vez, y "recuérdame comprar pan y leche" es un solo recordatorio.
export function parseCompound(raw: string, now: Date): Intent[] | null {
  const parts = raw.split(/\s*,?\s+(?:y|e)\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const intents: Intent[] = [];
  let verb = '';
  for (const part of parts) {
    let intent = parseIntent(part, now);
    if (intent.intent === 'desconocido' && verb) intent = parseIntent(`${verb} ${part}`, now);
    if (intent.intent === 'desconocido' || intent.intent.startsWith('recordatorio.')) return null;
    verb = part.match(/^\s*(?:(?:alfred|oye|por favor|puedes)\s+)*(\p{L}+)/iu)?.[1] ?? verb;
    intents.push(intent);
  }
  const families = new Set(intents.map(i => i.intent.split('.')[0]));
  return families.size > 1 ? intents : null;
}
