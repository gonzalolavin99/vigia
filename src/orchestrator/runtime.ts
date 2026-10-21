import {onAudioEvent, VigiaAudio} from '../native/vigiaAudio';
import {Assistant, Reminder, ReminderStore} from './assistant';
import {Orchestrator} from './machine';

// Recordatorios guardados en Android (SQLite + AlarmManager, ADR-009).
const nativeStore: ReminderStore = {
  add: async r => (await VigiaAudio.remindersAdd(r.text, r.at, r.kind)) as Reminder,
  list: async () => (await VigiaAudio.remindersList()) as Reminder[],
  remove: async id => { await VigiaAudio.remindersRemove(id); },
};
export const assistant = new Assistant(nativeStore);

// Una sola instancia por proceso. Se crea al cargar el bundle (index.js), con o sin la app abierta:
// el servicio arranca el runtime de JS aunque no haya pantalla (por ejemplo, tras reiniciar).
export const orchestrator = new Orchestrator({
  resolve: text => assistant.resolve(text),
  speak: async text => { await VigiaAudio.speak(text); },
  show: text => VigiaAudio.show(text),
  listenAgain: () => VigiaAudio.listenAgain(),
  endTurn: () => VigiaAudio.endTurn(),
});

onAudioEvent(event => {
  switch (event.type) {
    case 'wake': orchestrator.wake(); break;
    case 'captured': orchestrator.captured(); break;
    case 'timeout': orchestrator.timeout(); break;
    case 'transcript': orchestrator.transcript(event.text ?? ''); break;
    case 'error': orchestrator.error(); break;
  }
});
