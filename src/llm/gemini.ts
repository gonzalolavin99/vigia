import {buildPrompt, parseDecision, SYSTEM} from './prompt';
import type {ChatTurn, LlmClient, LlmDecision, Post} from './bridge';
import type {ToolSpec} from './tools';

// Gemini directo desde el teléfono, con la clave que Gonzalo pega en Ajustes (ADR-021). Solo viaja texto: la frase
// que las reglas no entendieron y la conversación corta. En el nivel gratis los modelos se saturan seguido (503) o
// tardan: se prueba el elegido y, si falla rápido, el siguiente. Si ninguno responde, devuelve null y Vigía dice
// que no entendió.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
/** Modelos que se comparan en Ajustes y se usan de respaldo, en ese orden (medición del 4 nov). */
export const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const CONNECT_MS = 3000;
const ATTEMPT_MS = 8000;
const TOTAL_MS = 14_000;

type Attempt = {status: number | 'sin-red'; ms: number; body?: string};

export class GeminiClient implements LlmClient {
  /** fallbacks: modelos a probar si el elegido falla; en la medición de Ajustes va vacío. */
  constructor(private readonly key: string, private readonly post: Post, private readonly model = DEFAULT_GEMINI_MODEL,
    private readonly log: (line: string) => void = () => {}, private readonly fallbacks = GEMINI_MODELS) {}

  async resolve(text: string, tools: ToolSpec[], history: ChatTurn[]): Promise<LlmDecision | null> {
    const prompt = buildPrompt({text, tools, history});
    const started = Date.now();
    const models = [this.model, ...this.fallbacks.filter(m => m !== this.model)];
    for (const model of models) {
      const left = TOTAL_MS - (Date.now() - started);
      if (left < 2000) break;
      // Pensar lo mínimo: para elegir una skill o contestar en una frase no hace falta más, y baja la espera.
      let attempt = await this.call(model, prompt, true, Math.min(ATTEMPT_MS, left));
      if (attempt.status === 400 && /thinking/i.test(attempt.body ?? '')) attempt = await this.call(model, prompt, false, Math.min(ATTEMPT_MS, left));
      if (attempt.status !== 200) {
        // Solo el código y el mensaje de error de Google, sin la clave ni el texto del usuario.
        this.log(`llm gemini model=${model} status=${attempt.status} ms=${attempt.ms} ${errorMessage(attempt.body)}`);
        continue;
      }
      const decision = parseDecision(answerText(attempt.body), tools);
      this.log(`llm gemini model=${model} status=200 ms=${attempt.ms} tool=${decision ? decision.tool : 'invalida'}`);
      if (decision) return {...decision, source: 'gemini'};
    }
    return null;
  }

  private async call(model: string, prompt: string, minimalThinking: boolean, totalMs: number): Promise<Attempt> {
    const body = {
      systemInstruction: {parts: [{text: SYSTEM}]},
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {responseMimeType: 'application/json', temperature: 0.2,
        ...(minimalThinking ? {thinkingConfig: {thinkingLevel: 'minimal'}} : {})},
    };
    const started = Date.now();
    const response = await this.post(`${API}/${model}:generateContent`, JSON.stringify(body),
      {'x-goog-api-key': this.key}, CONNECT_MS, totalMs).catch(() => null);
    return {status: response?.status ?? 'sin-red', ms: Date.now() - started, body: response?.body};
  }
}

function answerText(body: string | undefined): string {
  try {
    const parts: {text?: string; thought?: boolean}[] = JSON.parse(body ?? '').candidates?.[0]?.content?.parts ?? [];
    return parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
  } catch {
    return '';
  }
}

function errorMessage(body: string | undefined): string {
  try { return String(JSON.parse(body ?? '').error?.message ?? '').slice(0, 160); } catch { return ''; }
}
