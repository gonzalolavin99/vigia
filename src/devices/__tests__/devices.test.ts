import {Assistant, Reminder, ReminderStore} from '../../orchestrator/assistant';
import {Home} from '../home';
import {SamsungAdapter} from '../samsung';
import {DeviceConfig, HomeConfig, Net} from '../types';
import {WizAdapter} from '../wiz';
import {OpenMeteo} from '../weather';

// Casa de prueba con la misma forma que la de Gonzalo (22 oct): cocina con 2 luces, living con 1 y la tele.
const light = (id: string, name: string, mac: string, ip: string, zone: string): DeviceConfig =>
  ({id, name, kind: 'light', brand: 'wiz', mac, ip, zone, groups: ['casa']});
const CONFIG: HomeConfig = {
  latitude: -33.4, longitude: -70.53,
  devices: [
    light('luz-cocina', 'luz cocina', 'aa0001', '10.0.0.34', 'cocina'),
    light('luz-pasillo', 'luz pasillo', 'aa0002', '10.0.0.35', 'cocina'),
    light('luz-living', 'luz living', 'aa0003', '10.0.0.37', 'living'),
    {id: 'tele', name: 'tele', kind: 'tv', brand: 'samsung', mac: '04:E4:B6:00:00:01', ip: '10.0.0.17', zone: 'living', groups: []},
  ],
};

/** Red falsa: ampolletas WiZ que responden por UDP y una TV con estado y aviso de permiso. */
class FakeNet implements Net {
  bulbs = new Map<string, {mac: string; state: boolean; dimming: number; temp: number}>();
  udpSent: {host: string; payload: any}[] = [];
  tvState: 'on' | 'standby' | 'off' = 'on';
  tvAccepts = true;
  keys: string[] = [];
  wol: string[] = [];
  kv = new Map<string, string>();

  constructor() {
    CONFIG.devices.filter(d => d.kind === 'light').forEach(d => this.bulbs.set(d.ip!, {mac: d.mac, state: false, dimming: 100, temp: 2700}));
  }

  async udp(host: string, _port: number, payload: string) {
    const msg = JSON.parse(payload);
    this.udpSent.push({host, payload: msg});
    const targets = host.endsWith('.255') ? [...this.bulbs.entries()] : this.bulbs.has(host) ? [[host, this.bulbs.get(host)!] as const] : [];
    return targets.map(([ip, bulb]) => {
      if (msg.method === 'setPilot') Object.assign(bulb, msg.params);
      const result = msg.method === 'getPilot' ? {mac: bulb.mac, state: bulb.state, dimming: bulb.dimming, temp: bulb.temp} : {success: true};
      return {from: ip, payload: JSON.stringify({method: msg.method, result})};
    });
  }
  async wakeOnLan(mac: string) { this.wol.push(mac); this.tvState = 'standby'; }
  async ws(url: string, messages: string[]) {
    if (this.tvState === 'off') return ['{"event":"vigia.error"}'];
    if (!this.tvAccepts) return ['{"event":"ms.channel.unauthorized"}'];
    messages.forEach(m => {
      const key = JSON.parse(m).params.DataOfCmd;
      this.keys.push(key);
      if (key === 'KEY_POWER') this.tvState = this.tvState === 'on' ? 'standby' : 'on';
    });
    return [JSON.stringify({event: 'ms.channel.connect', data: url.includes('token=') ? {} : {token: 'T123'}})];
  }
  async httpGet() {
    return this.tvState === 'off' ? null : JSON.stringify({device: {PowerState: this.tvState}});
  }
  async kvGet(key: string) { return this.kv.get(key) ?? null; }
  kvSet(key: string, value: string) { this.kv.set(key, value); }
}

class NoReminders implements ReminderStore {
  async add(r: Omit<Reminder, 'id'>) { return {...r, id: 1}; }
  async list() { return []; }
  async remove() {}
}

function setup() {
  const net = new FakeNet();
  const weather = new OpenMeteo(-33.4, -70.53, async () => ({ok: true, json: async () => ({current: {temperature_2m: 12.5, apparent_temperature: 11, weather_code: 3}})}));
  const home = new Home(CONFIG, new WizAdapter(net, '10.0.0.255'), new SamsungAdapter(net, async () => {}), weather);
  const assistant = new Assistant(new NoReminders(), () => new Date(2026, 9, 22, 20, 0), null, async () => home);
  return {net, home, assistant};
}

describe('Home.resolveLights', () => {
  const {home} = setup();
  const names = (target?: string) => home.resolveLights(target)?.map(d => d.name) ?? null;
  it.each<[string | undefined, string[] | null]>([
    ['la luz de la cocina', ['luz cocina']],
    ['las luces de la cocina', ['luz cocina', 'luz pasillo']],
    ['la cocina', ['luz cocina']],
    ['la luz del pasillo', ['luz pasillo']],
    ['la luz del living', ['luz living']],
    ['todo', ['luz cocina', 'luz pasillo', 'luz living']],
    ['la casa', ['luz cocina', 'luz pasillo', 'luz living']],
    ['las luces', ['luz cocina', 'luz pasillo', 'luz living']],
    ['la luz', []],
    [undefined, []],
    ['el garaje', null],
  ])('%s → %j', (target, expected) => expect(names(target)).toEqual(expected));
});

describe('WiZ', () => {
  it('prende, atenúa y cambia el tono por UDP', async () => {
    const {net, assistant} = setup();
    await expect(assistant.resolve('prende la luz del living')).resolves.toEqual({say: 'Listo.', show: 'Prendí la luz living.'});
    expect(net.bulbs.get('10.0.0.37')!.state).toBe(true);
    await expect(assistant.resolve('pon la luz del living al 30 por ciento')).resolves.toEqual({say: 'Listo.', show: 'La luz living al 30 %.'});
    expect(net.bulbs.get('10.0.0.37')!.dimming).toBe(30);
    await assistant.resolve('luz fría en el living');
    expect(net.bulbs.get('10.0.0.37')!.temp).toBe(6500);
  });

  it('"apaga todo" apaga las 3 luces', async () => {
    const {net, assistant} = setup();
    net.bulbs.forEach(b => (b.state = true));
    await expect(assistant.resolve('apaga todo')).resolves.toEqual({say: 'Listo.', show: 'Apagué las 3 luces de la casa.'});
    expect([...net.bulbs.values()].every(b => !b.state)).toBe(true);
  });

  it('pregunta cuál luz si no se dice', async () => {
    const {net, assistant} = setup();
    await expect(assistant.resolve('prende la luz')).resolves.toEqual({say: '¿Cuál luz? Tengo cocina, pasillo, living.', expectReply: true});
    await expect(assistant.resolve('la del pasillo')).resolves.toEqual({say: 'Listo.', show: 'Prendí la luz pasillo.'});
    expect(net.bulbs.get('10.0.0.35')!.state).toBe(true);
  });

  it('encuentra la ampolleta por su MAC si cambió de IP', async () => {
    const {net, assistant} = setup();
    const bulb = net.bulbs.get('10.0.0.34')!;
    net.bulbs.delete('10.0.0.34');
    net.bulbs.set('10.0.0.99', bulb);
    await expect(assistant.resolve('prende la luz de la cocina')).resolves.toEqual({say: 'Listo.', show: 'Prendí la luz cocina.'});
    expect(bulb.state).toBe(true);
    expect(net.udpSent.some(s => s.host === '10.0.0.255')).toBe(true);
  });

  it('dice qué luz no respondió', async () => {
    const {net, assistant} = setup();
    net.bulbs.delete('10.0.0.35');
    const reply = await assistant.resolve('prende las luces de la cocina');
    expect(reply.say).toBe('Prendí las 2 luces de la cocina, pero no pude con luz pasillo.');
  });
});

describe('TV Samsung', () => {
  it('se empareja la primera vez y guarda el token', async () => {
    const {net, assistant} = setup();
    await expect(assistant.resolve('apaga la tele')).resolves.toEqual({say: 'Listo.', show: 'Apagué la tele.'});
    expect(net.keys).toEqual(['KEY_POWER']);
    expect(net.kv.get('samsung-token-04:E4:B6:00:00:01')).toBe('T123');
  });

  it('sin emparejar, encender responde al tiro cómo conectarse (26 oct: quedaba pensando)', async () => {
    const {net, assistant} = setup();
    net.tvState = 'standby';
    const reply = await assistant.resolve('enciende televisión');
    expect(reply.say).toMatch(/^Primero tengo que conectarme con la tele/);
    expect(net.keys).toEqual([]);
  });

  it('«conecta la tele» empareja con la tele encendida', async () => {
    const {net, assistant} = setup();
    await expect(assistant.resolve('conecta la tele')).resolves.toEqual({say: 'Listo.', show: 'Conectado con la tele.'});
    expect(net.kv.get('samsung-token-04:E4:B6:00:00:01')).toBe('T123');
  });

  it('enciende desde apagada con Wake-on-LAN', async () => {
    const {net, assistant} = setup();
    net.kv.set('samsung-token-04:E4:B6:00:00:01', 'T123');
    net.tvState = 'off';
    await expect(assistant.resolve('prende la tele')).resolves.toEqual({say: 'Listo.', show: 'Prendí la tele.'});
    expect(net.wol).toEqual(['04:E4:B6:00:00:01']);
    expect(net.tvState).toBe('on');
  });

  it('no apaga una tele que ya está apagada (KEY_POWER la prendería)', async () => {
    const {net, assistant} = setup();
    net.tvState = 'standby';
    await assistant.resolve('apaga la tele');
    expect(net.keys).toEqual([]);
  });

  it('sube el volumen sin hablar', async () => {
    const {net, assistant} = setup();
    await expect(assistant.resolve('sube el volumen de la tele')).resolves.toEqual({say: ''});
    expect(net.keys).toEqual(['KEY_VOLUP', 'KEY_VOLUP', 'KEY_VOLUP']);
  });

  it('pide aceptar el aviso si la tele no da permiso', async () => {
    const {net, assistant} = setup();
    net.tvAccepts = false;
    const reply = await assistant.resolve('apaga la tele');
    expect(reply.say).toMatch(/^La tele no me dio permiso/);
  });
});

describe('clima', () => {
  it('dice la temperatura exterior', async () => {
    const {assistant} = setup();
    await expect(assistant.resolve('¿qué temperatura hace afuera?')).resolves.toEqual({say: 'Afuera hay 13 grados y está nublado.'});
  });

  it('aclara que no hay sensor adentro (ADR-017)', async () => {
    const {assistant} = setup();
    await expect(assistant.resolve('¿qué temperatura hay en la pieza?')).resolves.toEqual({say: 'No tengo un sensor adentro. Afuera hay 13 grados y está nublado.'});
  });
});

describe('LLM de respaldo (fase 5)', () => {
  function withLlm(decision: {tool: string | null; args: Record<string, unknown>; say: string} | null) {
    const net = new FakeNet();
    const home = new Home(CONFIG, new WizAdapter(net, '10.0.0.255'), new SamsungAdapter(net, async () => {}));
    const asked: {text: string; tools: {name: string; description: string}[]}[] = [];
    const llm = {resolve: async (text: string, tools: {name: string; description: string}[]) => { asked.push({text, tools}); return decision && {...decision, source: 'claude'}; }};
    const assistant = new Assistant(new NoReminders(), () => new Date(2026, 9, 28, 20, 0), null, async () => home, async () => llm);
    return {net, asked, assistant};
  }

  it('lo que las reglas no entienden lo resuelve el LLM con las skills ("apaga todo menos la del living")', async () => {
    const {net, asked, assistant} = withLlm({tool: 'luz.apagar', args: {target: ['luz cocina', 'luz pasillo']}, say: 'Listo.'});
    net.bulbs.forEach(b => (b.state = true));
    const reply = await assistant.resolve('deja solo la del living');
    expect(reply.say).toBe('Listo.');
    expect(net.bulbs.get('10.0.0.34')!.state).toBe(false);
    expect(net.bulbs.get('10.0.0.35')!.state).toBe(false);
    expect(net.bulbs.get('10.0.0.37')!.state).toBe(true);
    expect(asked[0].tools.find(t => t.name === 'luz.apagar')!.description).toContain('luz living (living)');
  });

  it('modo charla: responde lo que dice el LLM', async () => {
    const {assistant} = withLlm({tool: null, args: {}, say: 'Los Simpsons los creó Matt Groening.'});
    await expect(assistant.resolve('quién creó los Simpsons')).resolves.toEqual({say: 'Los Simpsons los creó Matt Groening.'});
  });

  it('con el PC apagado responde que no entendió', async () => {
    const {assistant} = withLlm(null);
    const reply = await assistant.resolve('quién creó los Simpsons');
    expect(reply.say).toMatch(/^No te entendí bien/);
  });

  it('ignora una herramienta inventada', async () => {
    const {assistant} = withLlm({tool: 'puerta.abrir', args: {}, say: ''});
    expect((await assistant.resolve('abre la puerta')).say).toMatch(/^No te entendí bien/);
  });
});
