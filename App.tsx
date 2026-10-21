import React, {useState} from 'react';
import {Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import Home from './src/ui/Home';
import Settings from './src/ui/Settings';
import {colors} from './src/ui/theme';
import {useVigia} from './src/ui/useVigia';

// Dos pestañas: Inicio (esfera, temporizadores, recordatorios, historial) y Ajustes (diagnóstico, voz, registro).
export default function App(): React.JSX.Element {
  const vigia = useVigia();
  const [tab, setTab] = useState<'home' | 'settings'>('home');
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.brand}>VIGÍA</Text>
          <View style={styles.tabs}>
            <Tab label="Inicio" active={tab === 'home'} onPress={() => setTab('home')} />
            <Tab label="Ajustes" active={tab === 'settings'} onPress={() => setTab('settings')} />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'home' ? <Home vigia={vigia} /> : <Settings vigia={vigia} />}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Tab({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{selected: active}} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10},
  brand: {color: colors.accent, fontSize: 15, fontWeight: '800', letterSpacing: 3},
  tabs: {flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 3},
  tab: {paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10},
  tabActive: {backgroundColor: colors.cardBorder},
  tabText: {color: colors.muted, fontSize: 14, fontWeight: '600'},
  tabTextActive: {color: colors.text},
  content: {padding: 20, paddingTop: 4, paddingBottom: 40},
});
