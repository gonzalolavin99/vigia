import {readFileSync} from 'fs';
import {join} from 'path';
import {parseIntent, Slots} from '../intents';

// Evaluación del motor de intenciones sobre eval/nlu.jsonl (docs/evaluacion.md): exactitud de intención y de slots,
// por separado en dev (donde se ajustan las reglas) y test (lo que se reporta). "Ahora" fijo del set.
const NOW = new Date(2026, 9, 21, 18, 0);
type Case = {text: string; intent: string; slots: Slots; source: string; split: 'dev' | 'test'};

const cases: Case[] = readFileSync(join(__dirname, '../../../eval/nlu.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(line => JSON.parse(line));

const sameSlots = (a: Slots, b: Slots) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function score(split: Case['split']) {
  const set = cases.filter(c => c.split === split);
  const errors: string[] = [];
  let intentOk = 0;
  let slotsOk = 0;
  for (const c of set) {
    const got = parseIntent(c.text, NOW);
    if (got.intent === c.intent) intentOk++;
    if (got.intent === c.intent && sameSlots(got.slots, c.slots)) slotsOk++;
    else errors.push(`  «${c.text}»\n    esperado ${c.intent} ${JSON.stringify(c.slots)}\n    obtenido ${got.intent} ${JSON.stringify(got.slots)}`);
  }
  return {n: set.length, intent: intentOk / set.length, slots: slotsOk / set.length, errors};
}

describe('eval/nlu.jsonl', () => {
  const report: string[] = [];
  afterAll(() => console.log(report.join('\n')));

  it.each(['dev', 'test'] as const)('%s: intención > 95 %% y slots > 90 %%', split => {
    const r = score(split);
    report.push(`${split}: intención ${(100 * r.intent).toFixed(1)} %, slots ${(100 * r.slots).toFixed(1)} % (n=${r.n})${r.errors.length ? '\n' + r.errors.join('\n') : ''}`);
    expect(r.intent).toBeGreaterThan(0.95);
    expect(r.slots).toBeGreaterThan(0.9);
  });
});
