import {useCallback, useEffect, useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import type {Reminder} from '../orchestrator/assistant';
import {getHistory, onHistory, Turn} from '../orchestrator/history';
import type {State} from '../orchestrator/machine';
import {assistant, orchestrator} from '../orchestrator/runtime';
import {onAudioEvent, VigiaAudio} from '../native/vigiaAudio';
import type {OrbMode} from './theme';

// Estado de la pantalla principal: escucha, esfera, recordatorios, temporizadores e historial.
export function useVigia() {
  const [running, setRunning] = useState(false);
  const [turn, setTurn] = useState<State>(orchestrator.state);
  const [ringing, setRinging] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<Turn[]>(getHistory());
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => {
    VigiaAudio.remindersList().then(list => setReminders(list as Reminder[])).catch(() => {});
  }, []);

  useEffect(() => {
    VigiaAudio.isRunning().then(setRunning);
    refresh();
    const offTurn = orchestrator.subscribe(state => {
      setTurn(state);
      // Al cerrar un turno pudo crearse o borrarse un recordatorio.
      if (state === 'idle') refresh();
    });
    const offHistory = onHistory(setHistory);
    const offAudio = onAudioEvent(event => {
      if (event.type === 'ringing') setRinging(true);
      if (event.type === 'ring_stopped') { setRinging(false); refresh(); }
      if (event.type === 'stopped' || event.type === 'error') setRunning(false);
    });
    // Reloj de la cuenta regresiva; cada 30 s se releen los recordatorios por si alguno ya sonó.
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const reload = setInterval(refresh, 30_000);
    return () => { offTurn(); offHistory(); offAudio(); clearInterval(tick); clearInterval(reload); };
  }, [refresh]);

  const start = useCallback(async (options = {diagnostic: false, saveAudio: false}) => {
    if (Platform.OS === 'android' && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) return false;
    await VigiaAudio.start(options);
    setRunning(true);
    return true;
  }, []);

  const stop = useCallback(() => { VigiaAudio.stop(); setRunning(false); }, []);

  const remove = useCallback(async (id: number) => {
    await VigiaAudio.remindersRemove(id);
    refresh();
  }, [refresh]);

  const mode: OrbMode = !running ? 'off'
    : ringing ? 'ringing'
    : turn === 'listening' ? 'listening'
    : turn === 'transcribing' || turn === 'resolving' ? 'thinking'
    : turn === 'speaking' ? 'speaking'
    : 'idle';

  const upcoming = reminders.filter(r => r.at > now - 60_000);
  return {
    running, mode, now, history, start, stop, remove, assistant,
    timers: upcoming.filter(r => r.kind === 'timer'),
    reminders: upcoming.filter(r => r.kind !== 'timer'),
  };
}
