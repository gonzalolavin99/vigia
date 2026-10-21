import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {VigiaAudio} from '../native/vigiaAudio';

// Pantalla sobre el bloqueo (ADR-012). ResponseActivity la abre con el texto y la cierra sola.
// Si es una alarma o temporizador sonando, muestra un botón grande para detenerla.
export default function ResponseScreen({text, alarm}: {text?: string; alarm?: boolean}): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>VIGÍA</Text>
      <Text style={styles.text}>{text || '…'}</Text>
      {alarm ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => VigiaAudio.stopAlarm()} style={styles.stop}>
            <Text style={styles.stopText}>Detener</Text>
          </Pressable>
          <Text style={styles.hint}>O di "Alfred, para".</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#101827', justifyContent: 'center', padding: 32},
  kicker: {color: '#6ee7b7', fontSize: 14, letterSpacing: 3, fontWeight: '700'},
  text: {color: '#f8fafc', fontSize: 40, fontWeight: '600', marginTop: 16, lineHeight: 50},
  stop: {backgroundColor: '#b45353', borderRadius: 24, paddingVertical: 28, alignItems: 'center', marginTop: 48},
  stopText: {color: 'white', fontSize: 32, fontWeight: '700'},
  hint: {color: '#94a3b8', fontSize: 16, marginTop: 16, textAlign: 'center'},
});
