import type {Orchestrator} from './machine';

// Últimos turnos (lo que dijo Gonzalo y lo que respondió Vigía). Vive junto al orquestador, no en la pantalla:
// se registra aunque la app esté cerrada y aparece al abrirla.
export type Turn = {id: number; at: number; heard: string; reply?: string};

const MAX = 20;
let turns: Turn[] = [];
let nextId = 1;
const listeners = new Set<(turns: Turn[]) => void>();

export function recordHistory(orchestrator: Orchestrator): void {
  orchestrator.subscribe((state, detail) => {
    if (state === 'resolving' && detail) {
      turns = [{id: nextId++, at: Date.now(), heard: detail}, ...turns].slice(0, MAX);
      emit();
    } else if (state === 'speaking' && detail) {
      if (turns[0] && !turns[0].reply) turns = [{...turns[0], reply: detail}, ...turns.slice(1)];
      else turns = [{id: nextId++, at: Date.now(), heard: '', reply: detail}, ...turns].slice(0, MAX);
      emit();
    }
  });
}

export function getHistory(): Turn[] {
  return turns;
}

export function onHistory(listener: (turns: Turn[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach(listener => listener(turns));
}
