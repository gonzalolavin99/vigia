// Prompt y validación compartidos por los dos caminos al LLM: Gemini desde el teléfono (ADR-021) y el puente del
// PC (ADR-016, server/core.ts). El modelo elige una herramienta (skill) con argumentos o responde una frase breve.
export type Turn = {role: 'user' | 'assistant'; text: string};
export type ResolveRequest = {text: string; tools: {name: string; description: string; args?: Record<string, string>}[]; history?: Turn[]};
export type Decision = {tool: string | null; args: Record<string, unknown>; say: string};

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
    'Responde solo con el JSON pedido: {"tool": nombre o null, "args": {...}, "say": "..."}.',
  ].join('\n');
}

/** Valida lo que devolvió el modelo; una herramienta que no está en la lista se descarta. */
export function parseDecision(raw: unknown, tools: {name: string}[]): Decision | null {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const say = typeof v.say === 'string' ? v.say.trim() : '';
  const tool = typeof v.tool === 'string' && tools.some(t => t.name === v.tool) ? v.tool : null;
  const args = tool && v.args && typeof v.args === 'object' ? (v.args as Record<string, unknown>) : {};
  if (!tool && !say) return null;
  return {tool, args, say};
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
