import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {OrbMode, orbColors} from './theme';

// Esfera de estado: respira tranquila esperando "Alfred", crece y late al escuchar, gira mientras piensa,
// pulsa al hablar y late rápido en rojo con una alarma sonando.
const SIZE = 190;

const motion: Record<OrbMode, {scale: [number, number]; ms: number; halo: number}> = {
  off: {scale: [1, 1], ms: 1000, halo: 0},
  idle: {scale: [0.94, 1], ms: 2600, halo: 0.18},
  listening: {scale: [1.06, 1.18], ms: 520, halo: 0.45},
  thinking: {scale: [1, 1.03], ms: 900, halo: 0.3},
  speaking: {scale: [0.98, 1.1], ms: 380, halo: 0.38},
  ringing: {scale: [1, 1.2], ms: 300, halo: 0.55},
};

export default function Orb({mode}: {mode: OrbMode}): React.JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const {scale, ms, halo} = motion[mode];
  const color = orbColors[mode];

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, {toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      Animated.timing(pulse, {toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
    ]));
    if (mode !== 'off') loop.start();
    return () => loop.stop();
  }, [mode, ms, pulse]);

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true}));
    if (mode === 'thinking') loop.start();
    return () => loop.stop();
  }, [mode, spin]);

  const coreScale = pulse.interpolate({inputRange: [0, 1], outputRange: scale});
  const haloScale = pulse.interpolate({inputRange: [0, 1], outputRange: [1.15, 1.45]});
  const haloOpacity = pulse.interpolate({inputRange: [0, 1], outputRange: [halo * 0.5, halo]});
  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});

  return (
    <View style={styles.box} accessibilityLabel={`Estado: ${mode}`}>
      <Animated.View style={[styles.circle, {backgroundColor: color, opacity: haloOpacity, transform: [{scale: haloScale}]}]} />
      {mode === 'thinking' ? (
        <Animated.View style={[styles.circle, styles.spinner, {borderTopColor: color, transform: [{rotate}, {scale: 1.12}]}]} />
      ) : null}
      <Animated.View style={[styles.circle, styles.core, {backgroundColor: color, transform: [{scale: coreScale}]}]}>
        <View style={styles.shine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {width: SIZE * 1.6, height: SIZE * 1.6, alignItems: 'center', justifyContent: 'center'},
  circle: {position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2},
  core: {opacity: 0.92, overflow: 'hidden'},
  spinner: {borderWidth: 5, borderColor: 'transparent', backgroundColor: 'transparent'},
  shine: {position: 'absolute', top: SIZE * 0.14, left: SIZE * 0.22, width: SIZE * 0.26, height: SIZE * 0.26, borderRadius: SIZE, backgroundColor: 'rgba(255,255,255,0.12)'},
});
