import {correctArtist, SEED_ARTISTS} from '../artists';

// Transcripciones reales de NeMo en el Realme (26 oct) y variantes esperables.
describe('correctArtist', () => {
  it.each([
    ['machine ganchelli', 'Machine Gun Kelly'],
    ['mckinne gun kelly', 'Machine Gun Kelly'],
    ['md k', 'Machine Gun Kelly'],
    ['m g k', 'Machine Gun Kelly'],
    ['queen', 'Queen'],
    ['olivia rodrigo', 'Olivia Rodrigo'],
    ['olivia rodrigues', 'Olivia Rodrigo'],
    ['linkin par', 'Linkin Park'],
    ['imagine dragon', 'Imagine Dragons'],
    ['ed shiran', 'Ed Sheeran'],
    ['billi ailish', 'Billie Eilish'],
    ['soda estereo', 'Soda Stereo'],
  ])('«%s» → %s', (heard, expected) => expect(correctArtist(heard, SEED_ARTISTS, true)).toBe(expected));

  it.each(['vivir sin aire', 'bohemian rhapsody', 'thriller', 'algo tranquilo'])(
    'no fuerza «%s» a un artista si no se pidió un artista', heard => expect(correctArtist(heard, SEED_ARTISTS, false)).toBeNull());

  it('no inventa un artista para algo que no se parece a ninguno', () => {
    expect(correctArtist('los jaivas de valparaiso', SEED_ARTISTS, true)).toBeNull();
  });
});
