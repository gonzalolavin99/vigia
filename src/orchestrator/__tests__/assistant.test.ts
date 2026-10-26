import {Assistant, NOT_UNDERSTOOD, Reminder, ReminderStore} from '../assistant';

// "Ahora": miércoles 21 de octubre de 2026, 18:00 (igual que eval/nlu.jsonl).
const NOW = new Date(2026, 9, 21, 18, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

class MemoryStore implements ReminderStore {
  items: Reminder[] = [];
  private next = 1;
  async add(r: Omit<Reminder, 'id'>) { const item = {...r, id: this.next++}; this.items.push(item); return item; }
  async list() { return [...this.items].sort((a, b) => a.at - b.at); }
  async remove(id: number) { this.items = this.items.filter(r => r.id !== id); }
}

function setup(reminders: Omit<Reminder, 'id'>[] = []) {
  const store = new MemoryStore();
  reminders.forEach(r => store.add(r));
  return {store, assistant: new Assistant(store, () => NOW)};
}

describe('hora y fecha', () => {
  it('dice la hora', async () => {
    const {assistant} = setup();
    await expect(assistant.resolve('¿Qué hora es?')).resolves.toEqual({say: 'Son las 6 en punto de la tarde.'});
  });

  it.each([
    ['¿Qué día es hoy?', 'Hoy es miércoles 21 de octubre.'],
    ['¿A cuánto estamos mañana?', 'Mañana es jueves 22 de octubre.'],
    ['Oye, ¿qué día es el 20 de noviembre?', 'El 20 de noviembre es viernes.'],
    ['¿qué día es el primero de enero?', 'El 1 de enero de 2027 es viernes.'],
  ])('%s → %s', async (text, expected) => {
    const {assistant} = setup();
    await expect(assistant.resolve(text)).resolves.toEqual({say: expected});
  });
});

describe('temporizador', () => {
  it('crea, consulta y cancela', async () => {
    const {store, assistant} = setup();
    await expect(assistant.resolve('Ponme un temporizador de 10 minutos')).resolves.toEqual({say: 'Listo.', show: 'Temporizador de 10 minutos.'});
    expect(store.items[0]).toMatchObject({kind: 'timer', at: NOW.getTime() + 600_000});
    await expect(assistant.resolve('¿cuánto falta?')).resolves.toEqual({say: 'Quedan 10 minutos.'});
    await expect(assistant.resolve('cancela el temporizador')).resolves.toEqual({say: 'Listo.', show: 'Temporizador cancelado.'});
    expect(store.items).toHaveLength(0);
  });
});

describe('recordatorios', () => {
  it('crea con fecha y hora', async () => {
    const {store, assistant} = setup();
    const reply = await assistant.resolve('recuérdame llamar a Felipe mañana a las nueve');
    expect(reply.show).toBe('Te recuerdo mañana a las 9 en punto de la mañana: llamar a Felipe.');
    expect(store.items[0]).toMatchObject({text: 'llamar a Felipe', at: at(22, 9), kind: 'reminder'});
  });

  it('pregunta la hora cuando falta y usa la respuesta', async () => {
    const {store, assistant} = setup();
    await expect(assistant.resolve('Recuérdame mañana de llamar a Felipe')).resolves.toEqual({say: '¿A qué hora?', expectReply: true});
    const reply = await assistant.resolve('a las 10 de la mañana');
    expect(reply.show).toBe('Te recuerdo mañana a las 10 en punto de la mañana: llamar a Felipe.');
    expect(store.items[0].at).toBe(at(22, 10));
  });

  it('acepta una hora suelta como respuesta ("nueve y media")', async () => {
    const {store, assistant} = setup();
    await assistant.resolve('recuérdame el 15 de diciembre de comprar los regalos');
    await assistant.resolve('nueve y media');
    expect(store.items[0].at).toBe(new Date(2026, 11, 15, 9, 30).getTime());
  });

  it('"a las doce de la noche" es la medianoche al final de ese día (caso real, 21 oct)', async () => {
    const {store, assistant} = setup();
    await assistant.resolve('¿Recuérdame el veinte de noviembre que viajo a España?');
    const reply = await assistant.resolve('A las doce de la noche.');
    expect(store.items[0].at).toBe(new Date(2026, 10, 21, 0, 0).getTime());
    expect(reply.show).toBe('Te recuerdo el sábado 21 de noviembre a las 12 en punto de la madrugada: viajo a España.');
  });

  it('se puede cancelar la pregunta', async () => {
    const {store, assistant} = setup();
    await assistant.resolve('recuérdame mañana de llamar a Felipe');
    await expect(assistant.resolve('no, olvídalo')).resolves.toEqual({say: 'Listo, no hago nada.'});
    expect(store.items).toHaveLength(0);
  });

  it('una respuesta que no es hora se trata como pedido nuevo', async () => {
    const {assistant} = setup();
    await assistant.resolve('recuérdame mañana de llamar a Felipe');
    await expect(assistant.resolve('¿qué hora es?')).resolves.toEqual({say: 'Son las 6 en punto de la tarde.'});
  });

  it('crea una alarma con "despiértame"', async () => {
    const {store, assistant} = setup();
    const reply = await assistant.resolve('despiértame mañana a las seis y media');
    expect(reply.show).toBe('Alarma para mañana a las 6 y media de la mañana.');
    expect(store.items[0]).toMatchObject({kind: 'alarm', at: at(22, 6, 30)});
  });

  it('lista por período', async () => {
    const {assistant} = setup([
      {text: 'llamar a felipe', at: at(22, 9), kind: 'reminder'},
      {text: 'comprar regalos', at: new Date(2026, 11, 15, 9).getTime(), kind: 'reminder'},
    ]);
    await expect(assistant.resolve('¿Me podrías decir mis recordatorios de este mes?')).resolves.toEqual({
      say: 'Tienes 1 recordatorio este mes: mañana a las 9 en punto de la mañana, llamar a felipe.',
    });
    const all = await assistant.resolve('¿Qué recordatorios tengo?');
    expect(all.say).toMatch(/^Tienes 2 recordatorios: /);
    await expect(assistant.resolve('¿qué recordatorios tengo hoy?')).resolves.toEqual({say: 'No tienes recordatorios para hoy.'});
  });

  it('borra uno específico sin preguntar', async () => {
    const {store, assistant} = setup([{text: 'ir al banco', at: at(23, 17), kind: 'reminder'}, {text: 'dentista', at: at(22, 10), kind: 'reminder'}]);
    const reply = await assistant.resolve('borra el de las cinco');
    expect(reply.show).toBe('Borré el recordatorio de pasado mañana a las 5 en punto de la tarde, ir al banco.');
    expect(store.items.map(r => r.text)).toEqual(['dentista']);
  });

  it('pregunta cuál borrar si hay varios ("borra este recordatorio")', async () => {
    const {store, assistant} = setup([{text: 'llamar a felipe', at: at(22, 9), kind: 'reminder'}, {text: 'ir al banco', at: at(23, 17), kind: 'reminder'}]);
    const question = await assistant.resolve('Borra este recordatorio');
    expect(question.expectReply).toBe(true);
    expect(question.say).toMatch(/^Tienes 2\. ¿Cuál borro\? El primero, mañana/);
    await expect(assistant.resolve('el segundo')).resolves.toEqual({say: 'Listo.', show: 'Borré el de pasado mañana a las 5 en punto de la tarde, ir al banco.'});
    expect(store.items.map(r => r.text)).toEqual(['llamar a felipe']);
  });

  it('confirma antes de borrar todos', async () => {
    const {store, assistant} = setup([{text: 'a', at: at(22, 9), kind: 'reminder'}, {text: 'b', at: at(23, 9), kind: 'reminder'}]);
    await expect(assistant.resolve('borra todos los recordatorios')).resolves.toEqual({say: '¿Borro tus 2 recordatorios?', expectReply: true});
    await expect(assistant.resolve('sí')).resolves.toEqual({say: 'Listo.', show: 'Borré todos tus recordatorios.'});
    expect(store.items).toHaveLength(0);
  });

  it('avisa si la hora ya pasó', async () => {
    const {assistant} = setup();
    await expect(assistant.resolve('recuérdame hoy a las 10 de la mañana regar')).resolves.toEqual({say: 'Esa hora ya pasó. ¿Me lo repites con otra hora?'});
  });
});

it('responde que no entendió lo que está fuera de alcance', async () => {
  const {assistant} = setup();
  await expect(assistant.resolve('conversemos un rato')).resolves.toEqual({say: NOT_UNDERSTOOD});
});

describe('música', () => {
  function withMusic(speaker: string | null = 'Echo Pop-WXJ') {
    const calls: string[] = [];
    let volume = 40;
    const music = {
      play: async (s?: {query: string; focus?: string; artist?: string}) => { calls.push(`play:${s ? [s.query, s.focus, s.artist].filter(Boolean).join('|') : ''}`); return true; },
      pause: async () => { calls.push('pause'); },
      next: async () => { calls.push('next'); },
      previous: async () => { calls.push('previous'); },
      volume: async (c: {by: 'up' | 'down'} | {percent: number}) => {
        volume = 'percent' in c ? c.percent : volume + (c.by === 'up' ? 10 : -10);
        return volume;
      },
      nowPlaying: async () => ({title: 'Bohemian Rhapsody', artist: 'Queen'}),
      speaker: async () => speaker,
    };
    return {calls, assistant: new Assistant(new MemoryStore(), () => NOW, music)};
  }

  it('pone lo pedido y lo confirma', async () => {
    const {calls, assistant} = withMusic();
    await expect(assistant.resolve('pon música de Queen')).resolves.toEqual({say: 'Listo.', show: 'Sonando: Bohemian Rhapsody, de Queen.'});
    expect(calls).toEqual(['play:queen|artist']);
  });

  it('avisa si el Echo no está conectado', async () => {
    const {assistant} = withMusic(null);
    const reply = await assistant.resolve('pon Bohemian Rhapsody');
    expect(reply.say).toBe('Listo. El Echo no está conectado, así que suena en el teléfono.');
  });

  it.each([['pausa', 'pause'], ['siguiente', 'next'], ['anterior', 'previous'], ['sigue con la música', 'play:']])(
    '«%s» actúa sin hablar', async (text, call) => {
      const {calls, assistant} = withMusic();
      await expect(assistant.resolve(text)).resolves.toEqual({say: ''});
      expect(calls).toEqual([call]);
    });

  it('ajusta y dice el volumen', async () => {
    const {assistant} = withMusic();
    await expect(assistant.resolve('sube el volumen')).resolves.toEqual({say: 'Listo.', show: 'Volumen al 50 %.'});
    await expect(assistant.resolve('volumen a la mitad')).resolves.toEqual({say: 'Listo.', show: 'Volumen al 50 %.'});
  });

  it('dice qué canción suena', async () => {
    const {assistant} = withMusic();
    await expect(assistant.resolve('¿qué canción es esta?')).resolves.toEqual({say: 'Es Bohemian Rhapsody, de Queen.'});
  });
});
