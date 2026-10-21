import {NativeEventEmitter, NativeModules} from 'react-native';

// Módulo nativo VigiaAudio (android/.../VigiaAudioModule.kt) con tipos.
export type AudioEvent = {
  type: 'status' | 'wake' | 'heard' | 'captured' | 'timeout' | 'transcript' | 'error' | 'stopped';
  text?: string; elapsedMs?: number; audioMs?: number; source?: string;
  count?: number; message?: string; kws?: boolean; textWake?: boolean; at?: number;
};

type VigiaAudioModule = {
  start(options: {diagnostic: boolean; saveAudio: boolean}): Promise<boolean>;
  stop(): void;
  isRunning(): Promise<boolean>;
  speak(text: string): Promise<boolean>;
  show(text: string): void;
  listenAgain(): void;
  endTurn(): void;
  listVoices(): Promise<{voices: Voice[]; current: string | null}>;
  setVoice(name: string): void;
  remindersAdd(text: string, at: number, kind: string): Promise<{id: number; text: string; at: number; kind: string}>;
  remindersList(): Promise<{id: number; text: string; at: number; kind: string}[]>;
  remindersRemove(id: number): Promise<boolean>;
};

export type Voice = {name: string; locale: string; network: boolean};

export const VigiaAudio = NativeModules.VigiaAudio as VigiaAudioModule;
const emitter = new NativeEventEmitter(NativeModules.VigiaAudio);

export function onAudioEvent(listener: (event: AudioEvent) => void): () => void {
  const sub = emitter.addListener('VigiaAudioEvent', (raw: Object) => listener(raw as AudioEvent));
  return () => sub.remove();
}
