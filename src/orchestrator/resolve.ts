import {decirHora, pideHora} from '../skills/hora';
import type {Reply} from './machine';

export const UNKNOWN_MESSAGE = 'Todavía no sé hacer eso. Por ahora puedo decirte la hora.';

// Resolución mínima de la fase 1. El motor de reglas con skills por dominio es de la fase 2 (ADR-006).
export async function resolvePhaseOne(text: string, now: () => Date = () => new Date()): Promise<Reply> {
  if (pideHora(text)) return {say: decirHora(now())};
  return {say: UNKNOWN_MESSAGE};
}
