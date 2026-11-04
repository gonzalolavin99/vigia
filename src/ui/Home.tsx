import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {Reminder} from '../orchestrator/assistant';
import type {Turn} from '../orchestrator/history';
import {horaCorta} from '../skills/say';
import Orb from './Orb';
import {colors, orbLabels} from './theme';
import type {useVigia} from './useVigia';

// Pantalla principal: esfera de estado, temporizadores en vivo, recordatorios por día e historial.
export default function Home({vigia}: {vigia: ReturnType<typeof useVigia>}): React.JSX.Element {
  const {running, mode, now, timers, reminders, history, start, remove, ringing, message, stopAlarm} = vigia;
  return (
    <View>
      <View style={styles.orbArea}>
        <Orb mode={mode} />
        <Text style={styles.orbLabel}>{orbLabels[mode]}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {ringing ? (
          <Pressable accessibilityRole="button" onPress={stopAlarm} style={styles.stopButton}>
            <Text style={styles.stopText}>Detener</Text>
          </Pressable>
        ) : null}
        {!running ? (
          <Pressable accessibilityRole="button" onPress={() => start()} style={styles.startButton}>
            <Text style={styles.startText}>Iniciar escucha</Text>
          </Pressable>
        ) : null}
      </View>

      {timers.length ? (
        <Section title="Temporizadores">
          {timers.map(t => <TimerRow key={t.id} timer={t} now={now} onCancel={() => remove(t.id)} />)}
        </Section>
      ) : null}

      <Section title="Recordatorios">
        {reminders.length === 0 ? <Text style={styles.empty}>Sin recordatorios. Prueba: «Alfred, recuérdame mañana a las 9 llamar a Felipe».</Text>
          : groupByDay(reminders, now).map(([day, items]) => (
            <View key={day} style={styles.group}>
              <Text style={styles.groupTitle}>{day}</Text>
              {items.map(r => <ReminderRow key={r.id} reminder={r} onDelete={() => remove(r.id)} />)}
            </View>
          ))}
      </Section>

      <Section title="Últimas instrucciones">
        {history.length === 0 ? <Text style={styles.empty}>Aún no le has pedido nada.</Text>
          : history.slice(0, 8).map(turn => <HistoryRow key={turn.id} turn={turn} />)}
      </Section>
    </View>
  );
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TimerRow({timer, now, onCancel}: {timer: Reminder; now: number; onCancel: () => void}) {
  const left = Math.max(0, Math.round((timer.at - now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const clock = `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  return (
    <View style={styles.timerRow}>
      <Text style={[styles.timerClock, left === 0 && styles.timerDone]}>{left === 0 ? '¡Listo!' : clock}</Text>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.smallButton}>
        <Text style={styles.smallButtonText}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

function ReminderRow({reminder, onDelete}: {reminder: Reminder; onDelete: () => void}) {
  const at = new Date(reminder.at);
  return (
    <View style={styles.reminderRow}>
      <Text style={styles.reminderTime}>{`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`}</Text>
      <Text style={styles.reminderText} numberOfLines={2}>{reminder.kind === 'alarm' ? '⏰ Alarma' : reminder.text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Borrar" onPress={onDelete} hitSlop={12}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </View>
  );
}

function HistoryRow({turn}: {turn: Turn}) {
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyTime}>{horaCorta(new Date(turn.at))}</Text>
      {turn.heard ? <Text style={styles.heard}>Tú: «{turn.heard}»</Text> : null}
      {turn.reply ? <Text style={styles.reply}>Vigía: {turn.reply}</Text> : null}
    </View>
  );
}

function groupByDay(items: Reminder[], now: number): [string, Reminder[]][] {
  const today = new Date(now);
  const dayIndex = (t: number) => {
    const d = new Date(t);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  };
  const groups = new Map<string, Reminder[]>();
  for (const r of items) {
    const i = dayIndex(r.at);
    const long = new Date(r.at).toLocaleDateString('es-CL', {weekday: 'long', day: 'numeric', month: 'long'});
    const label = i <= 0 ? 'Hoy' : i === 1 ? 'Mañana' : long.charAt(0).toUpperCase() + long.slice(1);
    groups.set(label, [...(groups.get(label) ?? []), r]);
  }
  return [...groups.entries()];
}

const styles = StyleSheet.create({
  orbArea: {alignItems: 'center', marginTop: 4, marginBottom: 8},
  orbLabel: {color: colors.text, fontSize: 22, fontWeight: '600', marginTop: -12},
  message: {color: colors.text, fontSize: 26, fontWeight: '500', textAlign: 'center', lineHeight: 34, marginTop: 14, paddingHorizontal: 8},
  stopButton: {backgroundColor: colors.dangerBg, borderColor: colors.danger, borderWidth: 2, borderRadius: 22, paddingVertical: 22, alignSelf: 'stretch', alignItems: 'center', marginTop: 20},
  stopText: {color: colors.text, fontSize: 30, fontWeight: '700'},
  startButton: {backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginTop: 18},
  startText: {color: colors.bg, fontSize: 17, fontWeight: '700'},
  card: {backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 16},
  cardTitle: {color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8},
  empty: {color: colors.faint, fontSize: 14, lineHeight: 20},
  timerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6},
  timerClock: {color: colors.text, fontSize: 44, fontWeight: '300', fontVariant: ['tabular-nums']},
  timerDone: {color: colors.danger, fontWeight: '600'},
  smallButton: {borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14},
  smallButtonText: {color: colors.muted, fontSize: 14},
  group: {marginTop: 6},
  groupTitle: {color: colors.accent, fontSize: 14, fontWeight: '600', marginTop: 6, marginBottom: 2},
  reminderRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomColor: colors.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth},
  reminderTime: {color: colors.text, fontSize: 17, fontWeight: '600', width: 58, fontVariant: ['tabular-nums']},
  reminderText: {color: colors.text, fontSize: 16, flex: 1},
  remove: {color: colors.faint, fontSize: 18, paddingHorizontal: 6},
  historyRow: {paddingVertical: 8, borderBottomColor: colors.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth},
  historyTime: {color: colors.faint, fontSize: 12},
  heard: {color: colors.muted, fontSize: 15, marginTop: 2},
  reply: {color: colors.text, fontSize: 15, marginTop: 2},
});
