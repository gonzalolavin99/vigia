import {stripAccents} from './normalize';

// Corrector de nombres de artistas (26 oct). NeMo es un modelo de español y escribe los nombres en inglés como
// suenan ("Machine Ganchelli", "Md. K."). Se comparan con una lista de artistas conocidos y se elige el más
// parecido si se parece lo suficiente. La lista parte con los de Gonzalo (pantalla de Apple Music, 20 oct) y
// populares, y crece con cada artista que suena en Apple Music (ver Assistant).

export const SEED_ARTISTS = [
  // De Gonzalo ("En loop", "Escuchado recientemente")
  'Olivia Rodrigo', 'Machine Gun Kelly', 'Linkin Park', 'Vicentico', 'The Theorist', 'Queen', 'honestav',
  // Populares en Chile e internacionales
  'Coldplay', 'Soda Stereo', 'Gustavo Cerati', 'Shakira', 'Maná', 'Imagine Dragons', 'Bad Bunny', 'Dua Lipa', 'Ed Sheeran',
  'Taylor Swift', 'The Weeknd', 'Billie Eilish', 'Arctic Monkeys', 'Red Hot Chili Peppers', 'Foo Fighters', 'Metallica',
  'AC/DC', "Guns N' Roses", 'Nirvana', 'Oasis', 'U2', 'The Beatles', 'The Rolling Stones', 'Pink Floyd', 'Led Zeppelin',
  'Bon Jovi', 'Michael Jackson', 'Bruno Mars', 'Post Malone', 'Twenty One Pilots', 'Green Day', 'Blink-182', 'Paramore',
  'Avril Lavigne', 'Panic! at the Disco', 'Fall Out Boy', 'My Chemical Romance', 'Muse', 'Radiohead', 'The Killers',
  'Kings of Leon', 'Maroon 5', 'OneRepublic', 'Lady Gaga', 'Rihanna', 'Beyoncé', 'Drake', 'Eminem', 'Kendrick Lamar',
  'Kanye West', 'Travis Scott', 'Doja Cat', 'Harry Styles', 'Sabrina Carpenter', 'Ariana Grande', 'Justin Bieber',
  'Karol G', 'J Balvin', 'Daddy Yankee', 'Rosalía', 'Mon Laferte', 'Los Bunkers', 'Los Prisioneros', 'Café Tacvba',
  'Juanes', 'Luis Miguel', 'Ricky Martin', 'Enrique Iglesias', 'Alejandro Sanz', 'Andrés Calamaro', 'Fito Páez',
  'Charly García', 'Los Fabulosos Cadillacs', 'Babasónicos', 'Jorge Drexler', 'Natalia Lafourcade', 'Peso Pluma', 'Feid',
  'Myke Towers', 'Rauw Alejandro', 'Ozuna', 'Anuel AA', 'Duki', 'Bizarrap', 'Nicki Nicole', 'Tini', 'Emilia', 'Trueno',
  'Pailita', 'Cris MJ', 'Marshmello', 'Avicii', 'David Guetta', 'Calvin Harris', 'Daft Punk', 'Gorillaz', 'Depeche Mode',
  'The Cure', 'Franz Ferdinand', 'The Strokes', 'Tame Impala', 'Lana Del Rey', 'Adele', 'Sam Smith', 'Lewis Capaldi',
  'Shawn Mendes', 'Camila Cabello', 'Selena Gomez', 'Miley Cyrus', 'Katy Perry', 'Evanescence', 'System of a Down',
  'Slipknot', 'Iron Maiden', 'Black Sabbath', 'Ozzy Osbourne', 'Queens of the Stone Age', 'The White Stripes',
  'Pearl Jam', 'Soundgarden', 'Alice in Chains', 'Creedence Clearwater Revival', 'Eagles', 'Fleetwood Mac', 'ABBA',
  'Bee Gees', 'Elton John', 'David Bowie', 'Prince', 'Madonna', 'Whitney Houston', 'Mariah Carey', 'Celine Dion',
  'Frank Sinatra', 'Nat King Cole', 'Elvis Presley', 'Bob Marley', 'Hans Zimmer', 'Ludovico Einaudi', 'Scott Buckley',
];

// Siglas que se dicen letra por letra; NeMo confunde letras parecidas ("Md. K." por "MGK").
const ACRONYMS: Record<string, string> = {mgk: 'Machine Gun Kelly', acdc: 'AC/DC', rhcp: 'Red Hot Chili Peppers', soad: 'System of a Down'};

const squash = (s: string) => stripAccents(s.toLowerCase()).replace(/[^a-z0-9]/g, '');

function levenshtein(a: string, b: string): number {
  const prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** 0–1: qué tanto se parecen, sin espacios, tildes ni signos ("machine ganchelli" ~ "Machine Gun Kelly" = 0,75). */
export function similarity(a: string, b: string): number {
  const x = squash(a);
  const y = squash(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/**
 * El artista conocido más parecido a lo que entendió NeMo, o null si ninguno se parece lo suficiente.
 * Con focus "artist" basta 0,7; sin saber si es artista o canción se exige 0,85 para no "corregir" títulos.
 */
export function correctArtist(heard: string, known: string[], isArtist: boolean): string | null {
  const letters = squash(heard);
  // Siglas: hasta 4 letras, admite una letra mal oída ("mdk" → "mgk").
  if (letters.length >= 2 && letters.length <= 4) {
    const acronym = Object.keys(ACRONYMS).find(a => a.length === letters.length && levenshtein(a, letters) <= (a.length >= 3 ? 1 : 0));
    if (acronym) return ACRONYMS[acronym];
  }
  let best: {name: string; score: number} | null = null;
  for (const name of known) {
    const score = similarity(heard, name);
    if (!best || score > best.score) best = {name, score};
  }
  if (!best) return null;
  if (best.score === 1) return best.name;
  return best.score >= (isArtist ? 0.7 : 0.85) ? best.name : null;
}
