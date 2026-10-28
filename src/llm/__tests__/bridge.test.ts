import {BridgeClient} from '../bridge';

describe('BridgeClient', () => {
  it('manda texto, herramientas e historial con la clave, y lee la decisión', async () => {
    const calls: {url: string; json: string; headers: Record<string, string>}[] = [];
    const client = new BridgeClient('http://pc:8787/', 'secreto', async (url, json, headers) => {
      calls.push({url, json, headers});
      return {status: 200, body: JSON.stringify({tool: 'hora', args: {}, say: '', source: 'claude', ms: 900})};
    });
    const decision = await client.resolve('qué hora es', [{name: 'hora', description: 'Decir la hora'}], []);
    expect(decision).toEqual({tool: 'hora', args: {}, say: '', source: 'claude'});
    expect(calls[0].url).toBe('http://pc:8787/v1/resolve');
    expect(calls[0].headers.authorization).toBe('Bearer secreto');
    expect(JSON.parse(calls[0].json).text).toBe('qué hora es');
  });

  it('PC apagado, error o respuesta rota: null', async () => {
    for (const response of [null, {status: 503, body: '{}'}, {status: 200, body: 'no es json'}]) {
      await expect(new BridgeClient('http://pc:8787', 't', async () => response).resolve('hola', [], [])).resolves.toBeNull();
    }
  });
});
