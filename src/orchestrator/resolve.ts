import {decirHora, pideHora} from '../skills/hora';
import type {Reply} from './machine';

// Casi todo lo que no calza es una transcripción confusa (voz lejana), no un pedido nuevo: se dice que no entendió.
export const UNKNOWN_MESSAGE = 'No te entendí bien. Por ahora solo sé decirte la hora.';

// Resolución mínima de la fase 1. El motor de reglas con skills por dominio es de la fase 2 (ADR-006).
export async function resolvePhaseOne(text: string, now: () => Date = () => new Date()): Promise<Reply> {
  if (pideHora(text)) return {say: decirHora(now())};
  return {say: UNKNOWN_MESSAGE};
}
