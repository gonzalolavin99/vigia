import {buildPrompt, parseDecision, resolve, Runner, ToolSpec} from '../core';

const TOOLS: ToolSpec[] = [
  {name: 'luz.apagar', description: 'Apaga luces', args: {target: 'qué luces'}},
  {name: 'musica.reproducir', description: 'Pone música en Apple Music', args: {query: 'qué buscar'}},
];

describe('parseDecision', () => {
  it('acepta una herramienta conocida con argumentos', () => {
    expect(parseDecision({tool: 'luz.apagar', args: {target: 'la cocina'}, say: 'Listo.'}, TOOLS))
      .toEqual({tool: 'luz.apagar', args: {target: 'la cocina'}, say: 'Listo.'});
  });

  it('descarta una herramienta inventada pero conserva la respuesta', () => {
    expect(parseDecision({tool: 'abrir.puerta', args: {}, say: 'No puedo abrir la puerta.'}, TOOLS))
      .toEqual({tool: null, args: {}, say: 'No puedo abrir la puerta.'});
  });

  it('lee JSON dentro de texto y rechaza respuestas vacías', () => {
    expect(parseDecision('Aquí va: {"tool": null, "args": {}, "say": "Hola"}', TOOLS)).toEqual({tool: null, args: {}, say: 'Hola'});
    expect(parseDecision({tool: null, args: {}, say: ''}, TOOLS)).toBeNull();
    expect(parseDecision('no es json', TOOLS)).toBeNull();
  });
});

describe('resolve', () => {
  const ok: Runner = async () => ({tool: null, args: {}, say: 'Hola, ¿cómo estás?'});
  const fails: Runner = async () => { throw new Error('límite'); };

  it('usa Claude cuando responde', async () => {
    await expect(resolve({text: 'hola', tools: TOOLS}, ok, fails)).resolves.toMatchObject({source: 'claude', say: 'Hola, ¿cómo estás?'});
  });

  it('cae a Ollama si Claude falla', async () => {
    await expect(resolve({text: 'hola', tools: TOOLS}, fails, ok)).resolves.toMatchObject({source: 'ollama'});
  });

  it('devuelve null si ambos fallan', async () => {
    await expect(resolve({text: 'hola', tools: TOOLS}, fails, fails)).resolves.toBeNull();
  });
});

it('el prompt lista herramientas, historial y el pedido', () => {
  const prompt = buildPrompt({text: 'apaga todo menos el living', tools: TOOLS, history: [{role: 'user', text: 'hola'}, {role: 'assistant', text: 'Hola.'}]});
  expect(prompt).toContain('- luz.apagar: Apaga luces. Argumentos: target (qué luces).');
  expect(prompt).toContain('Usuario: hola\nAlfred: Hola.');
  expect(prompt).toContain('Usuario: apaga todo menos el living');
});
