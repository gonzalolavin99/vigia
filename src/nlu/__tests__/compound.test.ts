import {parseCompound} from '../compound';

const NOW = new Date(2026, 10, 4, 12, 0);
const names = (text: string) => parseCompound(text, NOW)?.map(i => i.intent) ?? null;

describe('varias órdenes en una frase', () => {
  it('la segunda parte hereda el verbo', () => {
    expect(names('Apaga la televisión y las luces.')).toEqual(['tv.apagar', 'luz.apagar']);
    expect(names('prende la tele y la luz del living')).toEqual(['tv.encender', 'luz.encender']);
  });

  it('órdenes con verbo propio', () => {
    expect(names('apaga las luces y pon un temporizador de 10 minutos')).toEqual(['luz.apagar', 'temporizador.crear']);
  });

  it('no separa lo que es una sola orden', () => {
    expect(names('apaga la luz de la cocina y la del living')).toBeNull();
    expect(names('recuérdame mañana comprar pan y leche')).toBeNull();
    expect(names('pon rock and roll y blues')).toBeNull();
    expect(names('qué hora es')).toBeNull();
  });
});
