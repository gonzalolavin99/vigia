#!/usr/bin/env node
// Copia la configuración de la casa (dispositivos, zonas, ubicación) de vigia.local.json al teléfono, como
// files/config/home.json (ADR-020). Las MAC e IP quedan fuera de git.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const local = JSON.parse(readFileSync(new URL('../vigia.local.json', import.meta.url), 'utf8'));
if (!Array.isArray(local.devices) || typeof local.latitude !== 'number') {
  console.error('vigia.local.json no tiene "devices" ni ubicación; ver vigia.local.example.json');
  process.exit(1);
}
const home = { latitude: local.latitude, longitude: local.longitude, place: local.place, devices: local.devices };
const file = join(mkdtempSync(join(tmpdir(), 'vigia-')), 'home.json');
writeFileSync(file, JSON.stringify(home, null, 2));

const adb = [process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'), 'G:\Dev\Android\Sdk\platform-tools\adb.exe']
  .filter(Boolean).find(p => existsSync(p)) ?? 'adb';
const r = spawnSync(adb, ['push', file, '/sdcard/Android/data/cl.vigia.app/files/config/home.json'], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
if (r.status === 0) console.log(`Configuración copiada: ${home.devices.length} dispositivos en ${home.place ?? 'la casa'}.`);
process.exitCode = r.status ?? 1;
