// Lógica del puente LLM (fase 5, ADR-011 y ADR-016), sin red ni procesos: se prueba con Jest.
// El teléfono manda el texto que las reglas no entendieron, las herramientas (skills) disponibles y el historial
// corto. Claude (plan Pro, vía `claude -p`) elige una herramienta con argumentos o responde una frase breve.
// Si Claude falla, se intenta con Ollama; si ambos fallan, el teléfono dice que no entendió.

import {buildPrompt, parseDecision, SCHEMA, SYSTEM, type Decision, type ResolveRequest, type Turn} from '../src/llm/prompt.ts';

export {buildPrompt, parseDecision, SCHEMA, SYSTEM};
export type {Decision, ResolveRequest, Turn};
export type ToolSpec = ResolveRequest['tools'][number];
export type ResolveResponse = Decision & {source: 'claude' | 'ollama'; ms: number};

/** Una forma de preguntarle a un modelo: devuelve el JSON crudo que respondió, o lanza si falla. */
export type Runner = (system: string, prompt: string, schema: object) => Promise<unknown>;

export async function resolve(req: ResolveRequest, claude: Runner, ollama: Runner | null, now = () => Date.now()): Promise<ResolveResponse | null> {
  const started = now();
  const prompt = buildPrompt(req);
  for (const [source, run] of [['claude', claude], ['ollama', ollama]] as const) {
    if (!run) continue;
    try {
      const decision = parseDecision(await run(SYSTEM, prompt, SCHEMA), req.tools);
      if (decision) return {...decision, source, ms: now() - started};
    } catch {
      // Límite del plan, sin sesión, timeout o error: se intenta con el siguiente.
    }
  }
  return null;
}
