import {onAudioEvent, VigiaAudio} from '../native/vigiaAudio';
import {Assistant, MusicPlayer, Reminder, ReminderStore} from './assistant';
import {Orchestrator} from './machine';
import {Home} from '../devices/home';
import {SamsungAdapter} from '../devices/samsung';
import {HomeConfig, Net} from '../devices/types';
import {WizAdapter} from '../devices/wiz';
import {recordHistory} from './history';
import {BridgeClient, LlmClient} from '../llm/bridge';
import {GeminiClient} from '../llm/gemini';

// Recordatorios guardados en Android (SQLite + AlarmManager, ADR-009).
const nativeStore: ReminderStore = {
  add: async r => (await VigiaAudio.remindersAdd(r.text, r.at, r.kind)) as Reminder,
  list: async () => (await VigiaAudio.remindersList()) as Reminder[],
  remove: async id => { await VigiaAudio.remindersRemove(id); },
};
// Apple Music y volumen en Android (ADR-008).
const nativeMusic: MusicPlayer = {
  play: search => VigiaAudio.musicPlay(search?.query ?? null, search?.focus ?? null, search?.artist ?? null),
  pause: async () => { await VigiaAudio.musicPause(); },
  next: async () => { await VigiaAudio.musicNext(); },
  previous: async () => { await VigiaAudio.musicPrevious(); },
  volume: change => VigiaAudio.musicVolume(change),
  nowPlaying: () => VigiaAudio.musicNowPlaying(),
  speaker: () => VigiaAudio.musicSpeaker(),
  // Hasta 300 artistas que ya sonaron, guardados en el teléfono.
  knownArtists: async () => JSON.parse((await VigiaAudio.kvGet('known-artists')) ?? '[]'),
  rememberArtist: name => {
    VigiaAudio.kvGet('known-artists').then(raw => {
      const list: string[] = JSON.parse(raw ?? '[]');
      if (!list.includes(name)) VigiaAudio.kvSet('known-artists', JSON.stringify([name, ...list].slice(0, 300)));
    });
  },
};
// Red de Android para los adaptadores de dispositivos (ADR-020).
const nativeNet: Net = {
  udp: (host, port, payload, waitMs) => VigiaAudio.netUdp(host, port, payload, waitMs),
  wakeOnLan: async mac => { await VigiaAudio.netWakeOnLan(mac); },
  ws: (url, messages, waitMs, insecureLocal) => VigiaAudio.netWs(url, messages, waitMs, insecureLocal),
  httpGet: (url, waitMs) => VigiaAudio.netHttpGet(url, waitMs, true),
  kvGet: key => VigiaAudio.kvGet(key),
  kvSet: (key, value) => VigiaAudio.kvSet(key, value),
};

// La casa se arma una vez desde files/config/home.json (npm run push-config); si no existe, no hay dispositivos.
let homePromise: Promise<Home | null> | null = null;
export function loadHome(): Promise<Home | null> {
  homePromise ??= VigiaAudio.readConfig().then(text => {
    if (!text) return null;
    const config = JSON.parse(text) as HomeConfig;
    return new Home(config, new WizAdapter(nativeNet), new SamsungAdapter(nativeNet));
  }).catch(() => { homePromise = null; return null; });
  return homePromise;
}

// Lo que las reglas no entienden va a Gemini con la clave guardada en Ajustes (ADR-021). Sin clave, al puente del
// PC si home.json lo trae (ADR-016).
export const GEMINI_KEY = 'gemini-key';
export const GEMINI_MODEL = 'gemini-model';
async function loadLlm(): Promise<LlmClient | null> {
  const key = await VigiaAudio.kvGet(GEMINI_KEY);
  if (key) return new GeminiClient(key, VigiaAudio.netHttpPost, (await VigiaAudio.kvGet(GEMINI_MODEL)) ?? undefined, VigiaAudio.log);
  const bridge = (await loadHome())?.config.bridge;
  return bridge ? new BridgeClient(bridge.url, bridge.token, VigiaAudio.netHttpPost) : null;
}

export const assistant = new Assistant(nativeStore, () => new Date(), nativeMusic, loadHome, loadLlm);

// Una sola instancia por proceso. Se crea al cargar el bundle (index.js), con o sin la app abierta:
// el servicio arranca el runtime de JS aunque no haya pantalla (por ejemplo, tras reiniciar).
export const orchestrator = new Orchestrator({
  resolve: text => assistant.resolve(text),
  speak: async text => { await VigiaAudio.speak(text); },
  show: text => VigiaAudio.show(text),
  listenAgain: () => VigiaAudio.listenAgain(),
  endTurn: () => VigiaAudio.endTurn(),
});

recordHistory(orchestrator);

onAudioEvent(event => {
  switch (event.type) {
    case 'wake': orchestrator.wake(); break;
    case 'captured': orchestrator.captured(); break;
    case 'timeout': orchestrator.timeout(); break;
    case 'transcript': orchestrator.transcript(event.text ?? ''); break;
    case 'error': orchestrator.error(); break;
  }
});
