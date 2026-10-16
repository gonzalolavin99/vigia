import React, {useEffect, useState} from 'react';
import {NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

const {VigiaAudio} = NativeModules;
const events = new NativeEventEmitter(VigiaAudio);
type AudioEvent = {type: string; text?: string; elapsedMs?: number; count?: number; message?: string};

export default function App(): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState('Todavía no hay transcripciones.');
  const [latency, setLatency] = useState<number | null>(null);
  const [wakes, setWakes] = useState(0);
  const [status, setStatus] = useState('Servicio detenido');

  useEffect(() => {
    const sub = events.addListener('VigiaAudioEvent', (event: AudioEvent) => {
      if (event.type === 'status') setStatus(event.message ?? '');
      if (event.type === 'wake') setWakes(event.count ?? 0);
      if (event.type === 'transcript') { setTranscript(event.text ?? ''); setLatency(event.elapsedMs ?? null); }
      if (event.type === 'error') setStatus(`Error: ${event.message ?? 'desconocido'}`);
    });
    return () => sub.remove();
  }, []);

  async function toggle() {
    if (running) { VigiaAudio.stop(); setRunning(false); setStatus('Servicio detenido'); return; }
    if (Platform.OS === 'android' && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) {
      setStatus('Concede el permiso de micrófono para iniciar.'); return;
    }
    try { await VigiaAudio.start(); setRunning(true); setStatus('Escuchando “Hey Alfred” (KWS inglés experimental).'); }
    catch (error) { setStatus(`No se pudo iniciar: ${String(error)}`); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>VIGÍA · SPIKE DE AUDIO</Text><Text style={styles.title}>Diagnóstico de voz</Text>
    <Text style={styles.status}>{status}</Text>
    <Pressable accessibilityRole="button" onPress={toggle} style={[styles.button, running && styles.buttonStop]}><Text style={styles.buttonText}>{running ? 'Detener escucha' : 'Iniciar escucha'}</Text></Pressable>
    <View style={styles.card}><Text style={styles.label}>Activaciones</Text><Text style={styles.value}>{wakes}</Text>
      <Text style={styles.label}>Latencia de transcripción</Text><Text style={styles.value}>{latency === null ? '—' : `${latency} ms`}</Text>
      <Text style={styles.label}>Última transcripción</Text><Text style={styles.transcript}>{transcript}</Text></View>
    <Text style={styles.note}>Audio procesado localmente. Este modelo KWS solo está publicado para inglés; la detección del español queda por validar.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#101827'}, content: {padding: 24, flexGrow: 1, justifyContent: 'center'},
  kicker: {color: '#6ee7b7', fontSize: 12, letterSpacing: 2, fontWeight: '700'}, title: {color: '#f8fafc', fontSize: 30, fontWeight: '700', marginTop: 8},
  status: {color: '#cbd5e1', fontSize: 15, marginTop: 14}, button: {backgroundColor: '#10b981', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 26},
  buttonStop: {backgroundColor: '#b45353'}, buttonText: {color: 'white', fontSize: 16, fontWeight: '700'}, card: {backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginTop: 24},
  label: {color: '#94a3b8', fontSize: 13, marginTop: 10}, value: {color: '#f8fafc', fontSize: 22, fontWeight: '600', marginTop: 2},
  transcript: {color: '#f8fafc', fontSize: 18, marginTop: 6}, note: {color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 20},
});
