import {onAudioEvent, VigiaAudio} from '../native/vigiaAudio';
import {Assistant, MusicPlayer, Reminder, ReminderStore} from './assistant';
import {Orchestrator} from './machine';
import {recordHistory} from './history';

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
};
export const assistant = new Assistant(nativeStore, () => new Date(), nativeMusic);

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
