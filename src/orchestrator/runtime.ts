import {onAudioEvent, VigiaAudio} from '../native/vigiaAudio';
import {Orchestrator} from './machine';
import {resolvePhaseOne} from './resolve';

// Una sola instancia por proceso. Se crea al cargar el bundle (index.js), con o sin la app abierta:
// el servicio arranca el runtime de JS aunque no haya pantalla (por ejemplo, tras reiniciar).
export const orchestrator = new Orchestrator({
  resolve: text => resolvePhaseOne(text),
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
