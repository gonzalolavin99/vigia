import {buildPrompt, parseDecision, SYSTEM} from './prompt';
import type {ChatTurn, LlmClient, LlmDecision, Post} from './bridge';
import type {ToolSpec} from './tools';

// Gemini directo desde el teléfono, con la clave que Gonzalo pega en Ajustes (ADR-021). Solo viaja texto: la frase
// que las reglas no entendieron y la conversación corta. Sin internet, sin clave o con el límite gratis agotado
// (429) devuelve null y Vigía responde con las reglas.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const CONNECT_MS = 3000;
const TOTAL_MS = 15_000;

export class GeminiClient implements LlmClient {
  constructor(private readonly key: string, private readonly post: Post, private readonly model = DEFAULT_GEMINI_MODEL,
    private readonly log: (line: string) => void = () => {}) {}

  async resolve(text: string, tools: ToolSpec[], history: ChatTurn[]): Promise<LlmDecision | null> {
    const body = {
      systemInstruction: {parts: [{text: SYSTEM}]},
      contents: [{role: 'user', parts: [{text: buildPrompt({text, tools, history})}]}],
      generationConfig: {responseMimeType: 'application/json', temperature: 0.2},
    };
    const started = Date.now();
    const response = await this.post(`${API}/${this.model}:generateContent`, JSON.stringify(body),
      {'x-goog-api-key': this.key}, CONNECT_MS, TOTAL_MS).catch(() => null);
    const ms = Date.now() - started;
    if (!response || response.status !== 200) {
      // Solo el código y el mensaje de error de Google, sin la clave ni el texto del usuario.
      this.log(`llm gemini model=${this.model} status=${response?.status ?? 'sin-red'} ms=${ms} ${errorMessage(response?.body)}`);
      return null;
    }
    try {
      const parts: {text?: string; thought?: boolean}[] = JSON.parse(response.body).candidates?.[0]?.content?.parts ?? [];
      const answer = parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
      const decision = parseDecision(answer, tools);
      this.log(`llm gemini model=${this.model} status=200 ms=${ms} tool=${decision ? decision.tool : 'invalida'}`);
      return decision && {...decision, source: 'gemini'};
    } catch {
      return null;
    }
  }
}

function errorMessage(body: string | undefined): string {
  try { return String(JSON.parse(body ?? '').error?.message ?? '').slice(0, 160); } catch { return ''; }
}
