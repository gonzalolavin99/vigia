import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

// Pantalla sobre el bloqueo (ADR-012). ResponseActivity la abre con el texto y la cierra a los 8 s.
export default function ResponseScreen({text}: {text?: string}): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>VIGÍA</Text>
      <Text style={styles.text}>{text || '…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#101827', justifyContent: 'center', padding: 32},
  kicker: {color: '#6ee7b7', fontSize: 14, letterSpacing: 3, fontWeight: '700'},
  text: {color: '#f8fafc', fontSize: 40, fontWeight: '600', marginTop: 16, lineHeight: 50},
});
