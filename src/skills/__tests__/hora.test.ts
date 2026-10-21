import {decirHora, pideHora} from '../hora';
import {resolvePhaseOne, UNKNOWN_MESSAGE} from '../../orchestrator/resolve';

const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);

describe('decirHora', () => {
  it.each([
    [21, 51, 'Son las 9 y 51 de la noche.'],
    [13, 5, 'Es la 1 y 5 de la tarde.'],
    [12, 0, 'Son las 12 en punto del mediodía.'],
    [0, 30, 'Son las 12 y media de la madrugada.'],
    [7, 15, 'Son las 7 y cuarto de la mañana.'],
    [19, 59, 'Son las 7 y 59 de la tarde.'],
    [20, 0, 'Son las 8 en punto de la noche.'],
  ])('%i:%i → %s', (h, m, expected) => {
    expect(decirHora(at(h, m))).toBe(expected);
  });
});

describe('pideHora', () => {
  // Transcripciones reales de NeMo en el Realme (fase 0, 17–20 oct).
  it.each(['¿Qué hora es?', 'qué hora es', '¿ hora es', 'dime la hora', '¿dime ¿qué hora es?', 'Que hora es'])(
    'reconoce %s',
    text => expect(pideHora(text)).toBe(true),
  );

  it.each(['¿Qué día es hoy?', '¿Puedes poner música?', 'ahora no', 'horario de la tienda'])('no confunde %s', text =>
    expect(pideHora(text)).toBe(false),
  );
});

describe('resolvePhaseOne', () => {
  it('responde la hora', async () => {
    await expect(resolvePhaseOne('¿Qué hora es?', () => at(21, 51))).resolves.toEqual({say: 'Son las 9 y 51 de la noche.'});
  });

  it('avisa que aún no sabe otras cosas', async () => {
    await expect(resolvePhaseOne('pon música')).resolves.toEqual({say: UNKNOWN_MESSAGE});
  });
});
