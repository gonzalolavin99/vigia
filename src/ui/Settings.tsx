import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {AudioEvent, onAudioEvent, VigiaAudio, Voice} from '../native/vigiaAudio';
import {colors} from './theme';
import type {useVigia} from './useVigia';

// Ajustes y diagnóstico: modo diagnóstico, guardar audios para el set de pruebas, voz y registro de lo que oye.
type LogLine = {id: number; time: string; kind: 'wake' | 'heard' | 'command' | 'info'; text: string};
const SOURCES: Record<string, string> = {kws: 'detector', text: 'texto', 'text-inline': 'texto con comando', reply: 'respuesta'};
const MAX_LOG = 60;
let nextId = 0;

export default function Settings({vigia}: {vigia: ReturnType<typeof useVigia>}): React.JSX.Element {
  const {running, start, stop} = vigia;
  const [diagnostic, setDiagnostic] = useState(true);
  const [saveAudio, setSaveAudio] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voice, setVoice] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [musicAccess, setMusicAccess] = useState<boolean | null>(null);
  const [speaker, setSpeaker] = useState<string | null>(null);

  // Se revisa cada vez que se vuelve a la pestaña (por ejemplo, después de activar el acceso en Ajustes de Android).
  useEffect(() => {
    const check = () => { VigiaAudio.musicAccess().then(setMusicAccess); VigiaAudio.musicSpeaker().then(setSpeaker); };
    check();
    const timer = setInterval(check, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const add = (kind: LogLine['kind'], text: string, at?: number) => setLog(prev =>
      [{id: nextId++, time: new Date(at ?? Date.now()).toLocaleTimeString('es-CL', {hour12: false}), kind, text}, ...prev].slice(0, MAX_LOG));
    return onAudioEvent((event: AudioEvent) => {
      if (event.type === 'wake') add('wake', `Activación por ${SOURCES[event.source ?? ''] ?? event.source}`);
      if (event.type === 'heard') add('heard', `«${event.text || '…'}» ${event.kws ? 'detector ✓' : ''}${event.textWake ? ' "alfred" ✓' : ''}`, event.at);
      if (event.type === 'transcript') add('command', `Comando: «${event.text ?? ''}» (${event.elapsedMs} ms)`, event.at);
      if (event.type === 'error') add('info', `Error: ${event.message ?? ''}`);
    });
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

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Escucha</Text>
        <Row label="Modo diagnóstico (registra todo lo que oye)" value={diagnostic} onChange={setDiagnostic} disabled={running} />
        <Row label="Guardar audios en el teléfono (set de pruebas)" value={saveAudio} onChange={setSaveAudio} disabled={running} />
        <Pressable accessibilityRole="button" onPress={() => (running ? stop() : start({diagnostic, saveAudio}))}
          style={[styles.button, running && styles.buttonStop]}>
          <Text style={styles.buttonText}>{running ? 'Detener escucha' : 'Iniciar escucha'}</Text>
        </Pressable>
        {running ? <Text style={styles.note}>Para cambiar estas opciones, detén la escucha primero.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Música</Text>
        <Text style={styles.status}>Apple Music: {musicAccess === null ? '…' : musicAccess ? 'conectado ✓' : 'falta permiso'}</Text>
        <Text style={styles.status}>Parlante: {speaker ? `${speaker} ✓` : 'teléfono (Echo sin conectar)'}</Text>
        {musicAccess === false ? (
          <>
            <Text style={styles.note}>Vigía necesita "Acceso a notificaciones" solo para controlar la sesión de Apple Music. No lee tus notificaciones.</Text>
            <Pressable accessibilityRole="button" onPress={() => VigiaAudio.openNotificationAccess()} style={styles.button}>
              <Text style={styles.buttonText}>Dar acceso</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Voz</Text>
        {voices.length === 0 ? <Text style={styles.note}>Cargando voces…</Text> : voices.map(v =>
          <Pressable key={v.name} onPress={() => tryVoice(v.name)} style={[styles.voice, v.name === voice && styles.voiceOn]}>
            <Text style={styles.voiceText}>{v.name === voice ? '● ' : ''}{v.locale} · {v.name}{v.network ? ' (internet)' : ''}</Text>
          </Pressable>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registro</Text>
        {log.length === 0 ? <Text style={styles.note}>Aún no hay eventos en esta sesión.</Text> : log.map(line =>
          <Text key={line.id} style={[styles.logLine, styles[line.kind]]}>{line.time}  {line.text}</Text>)}
      </View>
    </View>
  );
}

function Row({label, value, onChange, disabled}: {label: string; value: boolean; onChange: (v: boolean) => void; disabled: boolean}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 16},
  cardTitle: {color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8},
  rowText: {color: colors.text, fontSize: 15, flex: 1, marginRight: 12},
  button: {backgroundColor: colors.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 16},
  buttonStop: {backgroundColor: '#b45353'},
  buttonText: {color: colors.bg, fontSize: 16, fontWeight: '700'},
  note: {color: colors.faint, fontSize: 13, marginTop: 8},
  status: {color: colors.text, fontSize: 15, marginTop: 4},
  voice: {backgroundColor: colors.bg, borderRadius: 10, padding: 12, marginTop: 6},
  voiceOn: {borderWidth: 1, borderColor: colors.accent},
  voiceText: {color: colors.text, fontSize: 13},
  logLine: {fontSize: 12, lineHeight: 18, marginTop: 3, fontFamily: 'monospace'},
  wake: {color: '#6ee7b7'}, heard: {color: '#cbd5e1'}, command: {color: '#fde68a'}, info: {color: '#fca5a5'},
});
