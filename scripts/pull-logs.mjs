#!/usr/bin/env node
// Copia los registros diarios de Vigía del teléfono a eval/phase0/device-logs/ (ignorado por git).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const adb = [process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'), 'G:\\Dev\\Android\\Sdk\\platform-tools\\adb.exe']
  .filter(Boolean)
  .find((p) => existsSync(p)) ?? 'adb';
const remote = '/sdcard/Android/data/cl.vigia.app/files/logs/.';
const local = new URL('../eval/phase0/device-logs/', import.meta.url);
mkdirSync(local, { recursive: true });

const r = spawnSync(adb, ['pull', remote, local.pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8' });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
if (r.status === 0) {
  console.log(`Registros en eval/phase0/device-logs/: ${readdirSync(local).join(', ')}`);
}
process.exitCode = r.status ?? 1;
