import {Deps, ERROR_MESSAGE, NOT_HEARD_MESSAGE, Orchestrator, State} from '../machine';

function setup(overrides: Partial<Deps> = {}) {
  const calls: string[] = [];
  const deps: Deps = {
    resolve: async text => ({say: `respuesta a ${text}`}),
    speak: async text => { calls.push(`speak:${text}`); },
    show: text => calls.push(`show:${text}`),
    listenAgain: () => calls.push('listenAgain'),
    endTurn: () => calls.push('endTurn'),
    ...overrides,
  };
  const orchestrator = new Orchestrator(deps);
  const states: State[] = [];
  orchestrator.subscribe(state => states.push(state));
  return {orchestrator, calls, states};
}

describe('Orchestrator', () => {
  it('recorre un turno completo y vuelve a idle', async () => {
    const {orchestrator, calls, states} = setup();
    orchestrator.wake();
    orchestrator.captured();
    await orchestrator.transcript('¿Qué hora es?');
    expect(states).toEqual(['listening', 'transcribing', 'resolving', 'speaking', 'idle']);
    expect(calls).toEqual(['show:respuesta a ¿Qué hora es?', 'speak:respuesta a ¿Qué hora es?', 'endTurn']);
  });

  it('acepta un comando en línea sin wake previo ("Hola Alfred, ¿qué hora es?")', async () => {
    const {orchestrator, states} = setup();
    await orchestrator.transcript('qué hora es');
    expect(states).toEqual(['resolving', 'speaking', 'idle']);
  });

  it('vuelve a listening sin palabra de activación cuando la respuesta pide réplica', async () => {
    const {orchestrator, calls, states} = setup({resolve: async () => ({say: '¿A qué hora?', expectReply: true})});
    orchestrator.wake();
    await orchestrator.transcript('pon una alarma');
    expect(states.at(-1)).toBe('listening');
    expect(calls).toContain('listenAgain');
    expect(calls).not.toContain('endTurn');
  });

  it('cierra el turno si la activación no trae comando', () => {
    const {orchestrator, calls, states} = setup();
    orchestrator.wake();
    orchestrator.timeout();
    expect(states).toEqual(['listening', 'idle']);
    expect(calls).toEqual(['endTurn']);
  });

  it('pide repetir si la transcripción llega vacía', async () => {
    const {orchestrator, calls} = setup();
    orchestrator.wake();
    await orchestrator.transcript('  ');
    expect(calls[0]).toBe(`show:${NOT_HEARD_MESSAGE}`);
  });

  it('responde con un mensaje corto si resolver falla', async () => {
    const {orchestrator, calls, states} = setup({resolve: async () => { throw new Error('boom'); }});
    orchestrator.wake();
    await orchestrator.transcript('algo');
    expect(calls[0]).toBe(`show:${ERROR_MESSAGE}`);
    expect(states.at(-1)).toBe('idle');
  });

  it('cierra el turno aunque el TTS falle', async () => {
    const {orchestrator, calls, states} = setup({speak: async () => { throw new Error('tts'); }});
    await orchestrator.transcript('qué hora es');
    expect(calls).toContain('endTurn');
    expect(states.at(-1)).toBe('idle');
  });

  it('ignora una segunda activación durante un turno', async () => {
    const {orchestrator, states} = setup();
    orchestrator.wake();
    orchestrator.wake();
    expect(states).toEqual(['listening']);
  });

  it('ignora transcripciones mientras habla', async () => {
    let finishSpeaking: () => void = () => {};
    const {orchestrator, states} = setup({speak: () => new Promise<void>(done => { finishSpeaking = done; })});
    const first = orchestrator.transcript('qué hora es');
    await Promise.resolve();
    await orchestrator.transcript('otra cosa');
    finishSpeaking();
    await first;
    expect(states.filter(s => s === 'resolving')).toHaveLength(1);
  });
});
