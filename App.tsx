import React, {useEffect, useState} from 'react';
import {PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {AudioEvent, onAudioEvent, VigiaAudio, Voice} from './src/native/vigiaAudio';
import {orchestrator} from './src/orchestrator/runtime';
import type {State} from './src/orchestrator/machine';
type LogLine = {id: number; time: string; kind: 'wake' | 'heard' | 'command' | 'reply' | 'info'; text: string};

const MAX_LOG = 60;
const SOURCES: Record<string, string> = {kws: 'detector', text: 'texto', 'text-inline': 'texto con comando'};
const STATES: Record<State, string> = {idle: 'En espera', listening: 'Escuchando tu comando', transcribing: 'Transcribiendo', resolving: 'Pensando', speaking: 'Respondiendo'};
let nextId = 0;

function clock(at?: number): string {
  return new Date(at ?? Date.now()).toLocaleTimeString('es-CL', {hour12: false});
}

function seconds(ms?: number): string {
  return ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`;
}

export default function App(): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState(true);
  const [saveAudio, setSaveAudio] = useState(false);
  const [status, setStatus] = useState('Servicio detenido');
  const [wakes, setWakes] = useState(0);
  const [last, setLast] = useState<AudioEvent | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [turn, setTurn] = useState<State>(orchestrator.state);
  const [reply, setReply] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voice, setVoice] = useState<string | null>(null);

  // Tras reiniciar el teléfono el servicio arranca solo (ADR-003): reflejarlo al abrir la app.
  useEffect(() => {
    VigiaAudio.isRunning().then(isRunning => {
      if (isRunning) { setRunning(true); setStatus('Escuchando (servicio ya activo)'); }
    });
  }, []);

  useEffect(() => {
    const add = (kind: LogLine['kind'], text: string, at?: number) =>
      setLog(prev => [{id: nextId++, time: clock(at), kind, text}, ...prev].slice(0, MAX_LOG));
    const offTurn = orchestrator.subscribe((state, detail) => {
      setTurn(state);
      if (state === 'speaking' && detail) { setReply(detail); add('reply', `Vigía: «${detail}»`); }
    });
    const offAudio = onAudioEvent((event: AudioEvent) => {
      if (event.type === 'status') setStatus(event.message ?? '');
      if (event.type === 'wake') { setWakes(event.count ?? 0); add('wake', `Activación por ${SOURCES[event.source ?? ''] ?? event.source}: ${event.text ?? '?'}`); }
      if (event.type === 'heard') {
        const marks = `${event.kws ? 'detector ✓' : 'detector ✗'} · ${event.textWake ? '"alfred" en texto ✓' : 'sin "alfred"'}`;
        add('heard', `«${event.text || '…'}» (${seconds(event.audioMs)}) ${marks}`, event.at);
      }
      if (event.type === 'transcript') {
        setLast(event);
        add('command', `Comando: «${event.text ?? ''}» (${event.elapsedMs} ms)`, event.at);
      }
      // El servicio pudo morir por error o detenerse solo: el botón debe reflejarlo.
      if (event.type === 'error') { setRunning(false); setStatus(`Error: ${event.message ?? 'desconocido'}`); add('info', `Error: ${event.message ?? ''}`); }
      if (event.type === 'stopped') setRunning(false);
    });
    return () => { offAudio(); offTurn(); };
  }, []);

  // El motor de voz carga sus voces en segundo plano: se reintenta hasta que aparezcan.
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => VigiaAudio.listVoices().then(({voices: list, current}) => {
      setVoices(list);
      setVoice(current);
      if (list.length === 0 && tries++ < 10) timer = setTimeout(load, 1000);
    });
    load();
    return () => clearTimeout(timer);
  }, []);

  function tryVoice(name: string) {
    VigiaAudio.setVoice(name);
    setVoice(name);
    VigiaAudio.speak('Hola, soy Alfred. Son las nueve y media de la noche.').catch(() => {});
  }

  async function toggle() {
    if (running) { VigiaAudio.stop(); setRunning(false); setStatus('Servicio detenido'); return; }
    if (Platform.OS === 'android' && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) {
      setStatus('Concede el permiso de micrófono para iniciar.'); return;
    }
    try { await VigiaAudio.start({diagnostic, saveAudio}); setRunning(true); setStatus('Iniciando…'); }
    catch (error) { setStatus(`No se pudo iniciar: ${String(error)}`); }
  }

  return <SafeAreaProvider><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>VIGÍA · CICLO DE VOZ</Text><Text style={styles.title}>Asistente</Text>
    <Text style={styles.status}>{status}</Text>

    <View style={styles.row}><Text style={styles.rowText}>Modo diagnóstico (transcribe todo lo que oye)</Text>
      <Switch value={diagnostic} onValueChange={setDiagnostic} disabled={running} /></View>
    <View style={styles.row}><Text style={styles.rowText}>Guardar audios en el teléfono (para el set de pruebas)</Text>
      <Switch value={saveAudio} onValueChange={setSaveAudio} disabled={running} /></View>

    <Pressable accessibilityRole="button" onPress={toggle} style={[styles.button, running && styles.buttonStop]}><Text style={styles.buttonText}>{running ? 'Detener escucha' : 'Iniciar escucha'}</Text></Pressable>

    <View style={styles.card}>
      <Text style={styles.label}>Turno</Text><Text style={styles.value}>{STATES[turn]}</Text>
      <Text style={styles.label}>Última respuesta</Text><Text style={styles.transcript}>{reply ?? '—'}</Text>
      <Text style={styles.label}>Activaciones</Text><Text style={styles.value}>{wakes}</Text>
      <Text style={styles.label}>Último comando {last ? `(${last.elapsedMs} ms)` : ''}</Text>
      <Text style={styles.transcript}>{last?.text ?? '—'}</Text>
      {last ? <Text style={styles.label}>{seconds(last.audioMs)} de audio</Text> : null}
    </View>

    <Text style={styles.section}>Voz (toca una para escucharla y usarla)</Text>
    {voices.length === 0 ? <Text style={styles.note}>Cargando voces…</Text> : voices.map(v =>
      <Pressable key={v.name} onPress={() => tryVoice(v.name)} style={[styles.voice, v.name === voice && styles.voiceOn]}>
        <Text style={styles.voiceText}>{v.name === voice ? '● ' : ''}{v.locale} · {v.name}{v.network ? ' (requiere internet)' : ''}</Text>
      </Pressable>)}

    <Text style={styles.section}>Registro (lo más nuevo arriba)</Text>
    {log.length === 0 ? <Text style={styles.note}>Aún no hay eventos.</Text> : log.map(line =>
      <Text key={line.id} style={[styles.logLine, styles[line.kind]]}>{line.time}  {line.text}</Text>)}

    <Text style={styles.note}>Audio procesado localmente. Se activa por el detector de palabra clave o al encontrar "Alfred" en lo que transcribe (ADR-018).</Text>
  </ScrollView></SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#101827'}, content: {padding: 20, flexGrow: 1},
  kicker: {color: '#6ee7b7', fontSize: 12, letterSpacing: 2, fontWeight: '700'}, title: {color: '#f8fafc', fontSize: 28, fontWeight: '700', marginTop: 8},
  status: {color: '#cbd5e1', fontSize: 15, marginTop: 12},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14}, rowText: {color: '#e2e8f0', fontSize: 14, flex: 1, marginRight: 12},
  button: {backgroundColor: '#10b981', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20},
  buttonStop: {backgroundColor: '#b45353'}, buttonText: {color: 'white', fontSize: 16, fontWeight: '700'}, card: {backgroundColor: '#1e293b', borderRadius: 16, padding: 18, marginTop: 20},
  label: {color: '#94a3b8', fontSize: 13, marginTop: 10}, value: {color: '#f8fafc', fontSize: 22, fontWeight: '600', marginTop: 2},
  transcript: {color: '#f8fafc', fontSize: 18, marginTop: 4},
  section: {color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 6},
  logLine: {fontSize: 13, lineHeight: 19, marginTop: 4, fontFamily: 'monospace'},
  wake: {color: '#6ee7b7'}, heard: {color: '#cbd5e1'}, command: {color: '#fde68a'}, reply: {color: '#93c5fd'}, info: {color: '#fca5a5'},
  voice: {backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginTop: 6}, voiceOn: {borderWidth: 1, borderColor: '#6ee7b7'},
  voiceText: {color: '#e2e8f0', fontSize: 13},
  note: {color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 20},
});
