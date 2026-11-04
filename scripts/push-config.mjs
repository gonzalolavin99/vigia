#!/usr/bin/env node
// Copia la configuración de la casa (dispositivos, zonas, ubicación, puente LLM) de vigia.local.json al teléfono,
// como files/config/home.json (ADR-020). Las MAC, IP y la clave del puente quedan fuera de git.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';

const local = JSON.parse(readFileSync(new URL('../vigia.local.json', import.meta.url), 'utf8'));
if (!Array.isArray(local.devices) || typeof local.latitude !== 'number') {
  console.error('vigia.local.json no tiene "devices" ni ubicación; ver vigia.local.example.json');
  process.exit(1);
}
const home = { latitude: local.latitude, longitude: local.longitude, place: local.place, devices: local.devices };
// Puente LLM del PC (ADR-016), solo si se pide con "useBridge": true; por defecto el teléfono usa Gemini (ADR-021).
if (local.useBridge && local.bridgeToken) {
  home.bridge = { url: `http://${local.bridgeHost ?? lanAddress()}:${local.bridgePort ?? 8787}`, token: local.bridgeToken };
}
const file = join(mkdtempSync(join(tmpdir(), 'vigia-')), 'home.json');
writeFileSync(file, JSON.stringify(home, null, 2));

const adb = [process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'), 'G:/Dev/Android/Sdk/platform-tools/adb.exe']
  .filter(Boolean).find(p => existsSync(p)) ?? 'adb';
const r = spawnSync(adb, ['push', file, '/sdcard/Android/data/cl.vigia.app/files/config/home.json'], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
if (r.status === 0) {
  console.log(`Configuración copiada: ${home.devices.length} dispositivos en ${home.place ?? 'la casa'}, ${home.bridge ? `puente en ${home.bridge.url}` : 'sin puente del PC'}.`);
}
process.exitCode = r.status ?? 1;

function lanAddress() {
  const all = Object.values(networkInterfaces()).flat().filter(Boolean);
  return all.find(a => a.family === 'IPv4' && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address))?.address ?? '127.0.0.1';
}
