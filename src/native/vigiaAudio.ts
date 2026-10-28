import {NativeEventEmitter, NativeModules} from 'react-native';

// Módulo nativo VigiaAudio (android/.../VigiaAudioModule.kt) con tipos.
export type AudioEvent = {
  type: 'status' | 'wake' | 'heard' | 'captured' | 'timeout' | 'transcript' | 'error' | 'stopped' | 'ringing' | 'ring_stopped' | 'announce';
  text?: string; elapsedMs?: number; audioMs?: number; source?: string;
  count?: number; message?: string; kws?: boolean; textWake?: boolean; at?: number; ringing?: boolean;
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
  stopAlarm(): void;
  musicPlay(query: string | null, focus: string | null, artist: string | null): Promise<boolean>;
  musicPause(): Promise<boolean>;
  musicNext(): Promise<boolean>;
  musicPrevious(): Promise<boolean>;
  musicVolume(change: {by: 'up' | 'down'} | {percent: number}): Promise<number>;
  musicNowPlaying(): Promise<{title: string; artist: string} | null>;
  musicSpeaker(): Promise<string | null>;
  musicAccess(): Promise<boolean>;
  openNotificationAccess(): void;
  netUdp(host: string, port: number, payload: string, waitMs: number): Promise<{from: string; payload: string}[]>;
  netWakeOnLan(mac: string): Promise<boolean>;
  netWs(url: string, messages: string[], waitMs: number, insecureLocal: boolean): Promise<string[]>;
  netHttpGet(url: string, waitMs: number, insecureLocal: boolean): Promise<string | null>;
  netHttpPost(url: string, json: string, headers: Record<string, string>, connectMs: number, totalMs: number): Promise<{status: number; body: string} | null>;
  readConfig(): Promise<string | null>;
  kvGet(key: string): Promise<string | null>;
  kvSet(key: string, value: string): void;
  ringStatus(): Promise<{ringing: boolean; message: string | null}>;
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
