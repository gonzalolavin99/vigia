import type {ToolSpec} from './tools';

// Cliente del puente LLM del PC (fase 5, ADR-011 y ADR-016), detrás de LlmClient. Solo viaja texto; el audio nunca
// sale del teléfono. Con el PC apagado la conexión falla en ~2 s y Vigía sigue con las reglas.
export type ChatTurn = {role: 'user' | 'assistant'; text: string};
export type LlmDecision = {tool: string | null; args: Record<string, unknown>; say: string; source: string};

export interface LlmClient {
  resolve(text: string, tools: ToolSpec[], history: ChatTurn[]): Promise<LlmDecision | null>;
}

export type Post = (url: string, json: string, headers: Record<string, string>, connectMs: number, totalMs: number) =>
  Promise<{status: number; body: string} | null>;

const CONNECT_MS = 2000;
const TOTAL_MS = 30_000;

export class BridgeClient implements LlmClient {
  constructor(private readonly url: string, private readonly token: string, private readonly post: Post) {}

  async resolve(text: string, tools: ToolSpec[], history: ChatTurn[]): Promise<LlmDecision | null> {
    const response = await this.post(`${this.url.replace(/\/$/, '')}/v1/resolve`, JSON.stringify({text, tools, history}),
      {authorization: `Bearer ${this.token}`}, CONNECT_MS, TOTAL_MS);
    if (!response || response.status !== 200) return null;
    try {
      const d = JSON.parse(response.body);
      return {tool: d.tool ?? null, args: d.args ?? {}, say: String(d.say ?? ''), source: String(d.source ?? '')};
    } catch {
      return null;
    }
  }
}
