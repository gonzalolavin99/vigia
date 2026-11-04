import {GeminiClient} from '../gemini';

const TOOLS = [{name: 'hora' as const, description: 'Decir la hora'}];
const reply = (text: string) => ({status: 200, body: JSON.stringify({candidates: [{content: {parts: [{text}]}}]})});

describe('GeminiClient', () => {
  it('manda la clave en la cabecera, nunca en la URL, y lee la herramienta elegida', async () => {
    const calls: {url: string; json: string; headers: Record<string, string>}[] = [];
    const client = new GeminiClient('clave', async (url, json, headers) => {
      calls.push({url, json, headers});
      return reply('{"tool":"hora","args":{},"say":"Listo."}');
    });
    await expect(client.resolve('qué hora es', TOOLS, [])).resolves.toEqual({tool: 'hora', args: {}, say: 'Listo.', source: 'gemini'});
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    expect(calls[0].url).not.toContain('clave');
    expect(calls[0].headers['x-goog-api-key']).toBe('clave');
    expect(JSON.parse(calls[0].json).contents[0].parts[0].text).toContain('Usuario: qué hora es');
  });

  it('modo charla y herramienta inventada', async () => {
    const chat = new GeminiClient('k', async () => reply('{"tool":null,"args":{},"say":"Los creó Matt Groening."}'));
    await expect(chat.resolve('quién creó los Simpsons', TOOLS, [])).resolves.toMatchObject({tool: null, say: 'Los creó Matt Groening.'});
    const invented = new GeminiClient('k', async () => reply('{"tool":"puerta.abrir","args":{},"say":""}'));
    await expect(invented.resolve('abre la puerta', TOOLS, [])).resolves.toBeNull();
  });

  it('sin internet, límite agotado o respuesta rota: null', async () => {
    for (const response of [null, {status: 429, body: '{}'}, {status: 200, body: 'no es json'}]) {
      await expect(new GeminiClient('k', async () => response).resolve('hola', TOOLS, [])).resolves.toBeNull();
    }
    await expect(new GeminiClient('k', async () => { throw new Error('red'); }).resolve('hola', TOOLS, [])).resolves.toBeNull();
  });
});
