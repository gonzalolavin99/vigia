import React, {useEffect, useState} from 'react';
import {NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

const {VigiaAudio} = NativeModules;
const events = new NativeEventEmitter(VigiaAudio);
type AudioEvent = {
  type: string; text?: string; elapsedMs?: number; audioMs?: number; source?: string;
  count?: number; message?: string; kws?: boolean; textWake?: boolean; at?: number;
};
type LogLine = {id: number; time: string; kind: 'wake' | 'heard' | 'command' | 'info'; text: string};

const MAX_LOG = 60;
const SOURCES: Record<string, string> = {kws: 'detector', text: 'texto', 'text-inline': 'texto con comando'};
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

  useEffect(() => {
    const add = (kind: LogLine['kind'], text: string, at?: number) =>
      setLog(prev => [{id: nextId++, time: clock(at), kind, text}, ...prev].slice(0, MAX_LOG));
    const sub = events.addListener('VigiaAudioEvent', (raw: Object) => {
      const event = raw as AudioEvent;
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
    return () => sub.remove();
  }, []);

  async function toggle() {
    if (running) { VigiaAudio.stop(); setRunning(false); setStatus('Servicio detenido'); return; }
    if (Platform.OS === 'android' && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) {
      setStatus('Concede el permiso de micrófono para iniciar.'); return;
    }
    try { await VigiaAudio.start({diagnostic, saveAudio}); setRunning(true); setStatus('Iniciando…'); }
    catch (error) { setStatus(`No se pudo iniciar: ${String(error)}`); }
  }

  return <SafeAreaProvider><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>VIGÍA · SPIKE DE AUDIO</Text><Text style={styles.title}>Diagnóstico de voz</Text>
    <Text style={styles.status}>{status}</Text>

    <View style={styles.row}><Text style={styles.rowText}>Modo diagnóstico (transcribe todo lo que oye)</Text>
      <Switch value={diagnostic} onValueChange={setDiagnostic} disabled={running} /></View>
    <View style={styles.row}><Text style={styles.rowText}>Guardar audios en el teléfono (para el set de pruebas)</Text>
      <Switch value={saveAudio} onValueChange={setSaveAudio} disabled={running} /></View>

    <Pressable accessibilityRole="button" onPress={toggle} style={[styles.button, running && styles.buttonStop]}><Text style={styles.buttonText}>{running ? 'Detener escucha' : 'Iniciar escucha'}</Text></Pressable>

    <View style={styles.card}>
      <Text style={styles.label}>Activaciones</Text><Text style={styles.value}>{wakes}</Text>
      <Text style={styles.label}>Último comando {last ? `(${last.elapsedMs} ms)` : ''}</Text>
      <Text style={styles.transcript}>{last?.text ?? '—'}</Text>
      {last ? <Text style={styles.label}>{seconds(last.audioMs)} de audio</Text> : null}
    </View>

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
  wake: {color: '#6ee7b7'}, heard: {color: '#cbd5e1'}, command: {color: '#fde68a'}, info: {color: '#fca5a5'},
  note: {color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 20},
});
