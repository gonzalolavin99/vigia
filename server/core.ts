// Lógica del puente LLM (fase 5, ADR-011 y ADR-016), sin red ni procesos: se prueba con Jest.
// El teléfono manda el texto que las reglas no entendieron, las herramientas (skills) disponibles y el historial
// corto. Claude (plan Pro, vía `claude -p`) elige una herramienta con argumentos o responde una frase breve.
// Si Claude falla, se intenta con Ollama; si ambos fallan, el teléfono dice que no entendió.

export type ToolSpec = {name: string; description: string; args?: Record<string, string>};
export type Turn = {role: 'user' | 'assistant'; text: string};
export type ResolveRequest = {text: string; tools: ToolSpec[]; history?: Turn[]};
export type Decision = {tool: string | null; args: Record<string, unknown>; say: string};
export type ResolveResponse = Decision & {source: 'claude' | 'ollama'; ms: number};

/** Una forma de preguntarle a un modelo: devuelve el JSON crudo que respondió, o lanza si falla. */
export type Runner = (system: string, prompt: string, schema: object) => Promise<unknown>;

export const SCHEMA = {
  type: 'object',
  properties: {
    tool: {type: ['string', 'null'], description: 'Nombre exacto de la herramienta, o null para solo responder'},
    args: {type: 'object', description: 'Argumentos de la herramienta'},
    say: {type: 'string', description: 'Respuesta breve en voz alta, en español de Chile'},
  },
  required: ['tool', 'args', 'say'],
} as const;

export const SYSTEM = [
  'Eres Alfred, el asistente de voz de una casa en Chile. Hablas español de Chile, breve y cordial.',
  'Recibes lo que dijo el usuario, transcrito por voz: puede venir con errores, sobre todo en nombres en inglés.',
  'Si el pedido calza con una herramienta, devuelve su nombre exacto en "tool" y sus argumentos en "args",',
  'y en "say" una confirmación de una a cuatro palabras ("Listo."). Si es conversación o una pregunta general,',
  'deja "tool" en null y responde en "say" en una o dos frases cortas, aptas para leerse en voz alta, sin listas',
  'ni emojis. No inventes herramientas ni argumentos; si falta un dato, pregúntalo en "say" con "tool" null.',
].join(' ');

export function buildPrompt(req: ResolveRequest): string {
  const tools = req.tools.map(t => {
    const args = t.args ? ` Argumentos: ${Object.entries(t.args).map(([k, v]) => `${k} (${v})`).join(', ')}.` : '';
    return `- ${t.name}: ${t.description}.${args}`;
  }).join('\n');
  const history = (req.history ?? []).slice(-6).map(h => `${h.role === 'user' ? 'Usuario' : 'Alfred'}: ${h.text}`).join('\n');
  return [
    'Herramientas disponibles:', tools,
    history ? `\nConversación reciente:\n${history}` : '',
    `\nUsuario: ${req.text}`,
    'Responde solo con el JSON pedido.',
  ].join('\n');
}

/** Valida lo que devolvió el modelo; una herramienta que no está en la lista se descarta. */
export function parseDecision(raw: unknown, tools: ToolSpec[]): Decision | null {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const say = typeof v.say === 'string' ? v.say.trim() : '';
  const tool = typeof v.tool === 'string' && tools.some(t => t.name === v.tool) ? v.tool : null;
  const args = tool && v.args && typeof v.args === 'object' ? (v.args as Record<string, unknown>) : {};
  if (!tool && !say) return null;
  return {tool, args, say};
}

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

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
