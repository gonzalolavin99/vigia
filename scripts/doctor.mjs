#!/usr/bin/env node
// Comprobaciones de puesta en marcha (docs/puesta-en-marcha.md, sección 3).
// Sin dependencias: solo módulos de Node. Sale con código 1 si algo falla.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createSocket } from 'node:dgram';
import { join } from 'node:path';
import { homedir } from 'node:os';

const isWin = process.platform === 'win32';
const LOCAL = process.env.LOCALAPPDATA ?? '';
const results = [];

function record(name, status, detail, next = '') {
  results.push({ name, status, detail, next });
}

function loadConfig() {
  const file = new URL('../vigia.local.json', import.meta.url);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    record('Configuración local', 'FAIL', `vigia.local.json inválido: ${err.message}`, 'Corrige el JSON');
    return {};
  }
}

// Busca un ejecutable en el PATH o en las rutas de instalación habituales de Windows.
function findExe(name, candidates = []) {
  const which = spawnSync(isWin ? 'where' : 'which', [name], { encoding: 'utf8' });
  // Node no lanza .cmd/.bat sin shell (EINVAL); en Windows solo sirven los .exe del PATH.
  const found = which.status === 0
    ? which.stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l && (!isWin || /\.exe$/i.test(l)))
    : null;
  if (found) return found;
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

function run(exe, args, { timeout = 15000, env } = {}) {
  const r = spawnSync(exe, args, { encoding: 'utf8', timeout, env, windowsHide: true });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

function firstLine(text) {
  return text.split(/\r?\n/).find((l) => l.trim()) ?? '';
}

const exes = {
  git: findExe('git'),
  node: process.execPath,
  java: findExe('java', [
    process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', 'java.exe'),
    'G:\\Dev\\jdk-17\\bin\\java.exe',
  ]),
  adb: findExe('adb', [
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    'G:\\Dev\\Android\\Sdk\\platform-tools\\adb.exe',
  ]),
  claude: findExe('claude', [join(homedir(), '.local', 'bin', 'claude.exe'), 'G:\\Dev\\npm-global\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe']),
  ollama: findExe('ollama', ['G:\\Dev\\ollama\\app\\ollama.exe', join(LOCAL, 'Programs', 'Ollama', 'ollama.exe')]),
  // venv del proyecto en G: (C: no tiene espacio); si no existe, el Python del sistema.
  python: [process.env.VIGIA_VENV, 'G:\\Dev\\venvs\\vigia']
    .filter(Boolean)
    .map((dir) => join(dir, isWin ? 'Scripts\\python.exe' : 'bin/python'))
    .find((p) => existsSync(p)) ?? findExe('python') ?? findExe('py'),
};

function checkTools() {
  const versionArgs = {
    git: ['--version'],
    node: ['-v'],
    java: ['-version'],
    adb: ['version'],
    claude: ['--version'],
    ollama: ['--version'],
  };
  const hints = {
    git: 'winget install Git.Git',
    node: 'winget install OpenJS.NodeJS.LTS',
    java: 'winget install Microsoft.OpenJDK.17',
    adb: 'Instala Android Studio y el SDK (winget install Google.AndroidStudio)',
    claude: 'Instala Claude Code CLI y corre "claude" para iniciar sesión con tu cuenta Pro',
    ollama: 'winget install Ollama.Ollama',
  };
  for (const [tool, args] of Object.entries(versionArgs)) {
    const exe = exes[tool];
    if (!exe) {
      record(`Herramienta: ${tool}`, 'FAIL', 'No encontrada', hints[tool]);
      continue;
    }
    const r = run(exe, args);
    const ok = r.ok || (tool === 'java' && /version/.test(r.out));
    if (tool === 'java' && ok && !/version "17|openjdk 17/i.test(r.out)) {
      record('Herramienta: java', 'FAIL', firstLine(r.out), 'React Native pide JDK 17: winget install Microsoft.OpenJDK.17');
      continue;
    }
    record(`Herramienta: ${tool}`, ok ? 'PASS' : 'FAIL', ok ? firstLine(r.out) : r.out || String(r.error), ok ? '' : hints[tool]);
  }

  if (!exes.python) {
    record('Herramienta: sherpa-onnx (Python)', 'FAIL', 'Python no encontrado', 'winget install Python.Python.3.12');
  } else {
    const r = run(exes.python, ['-c', 'import sherpa_onnx; print(sherpa_onnx.__version__)']);
    record('Herramienta: sherpa-onnx (Python)', r.ok ? 'PASS' : 'FAIL', r.ok ? `sherpa-onnx ${r.out}` : 'Paquete no instalado', r.ok ? '' : 'python -m pip install sherpa-onnx');
  }
}

function checkPhone() {
  if (!exes.adb) {
    record('Teléfono conectado', 'SKIP', 'Sin adb', 'Instala Android Studio primero');
    return;
  }
  const r = run(exes.adb, ['devices']);
  const lines = r.out.split(/\r?\n/).slice(1).filter((l) => l.trim());
  const authorized = lines.filter((l) => /\tdevice$/.test(l));
  if (authorized.length !== 1) {
    const why = lines.some((l) => /unauthorized/.test(l))
      ? 'Dispositivo sin autorizar'
      : authorized.length > 1 ? 'Más de un dispositivo' : 'Ningún dispositivo';
    record('Teléfono conectado', 'FAIL', why, 'Conecta el Realme por USB, activa Depuración USB y acepta la huella del PC');
    record('Versión y arquitectura', 'SKIP', 'Sin teléfono', '');
    return;
  }
  record('Teléfono conectado', 'PASS', authorized[0].split('\t')[0]);
  const version = run(exes.adb, ['shell', 'getprop', 'ro.build.version.release']).out;
  const abi = run(exes.adb, ['shell', 'getprop', 'ro.product.cpu.abi']).out;
  const ok = version === '11' && abi === 'arm64-v8a';
  record('Versión y arquitectura', ok ? 'PASS' : 'FAIL', `Android ${version}, ${abi}`, ok ? '' : 'Se esperaba Android 11 y arm64-v8a; revisa docs/vision.md');
}

function checkClaude() {
  if (process.env.ANTHROPIC_API_KEY) {
    record('Claude con la suscripción', 'FAIL', 'ANTHROPIC_API_KEY está definida', 'Bórrala del entorno: con ella Claude Code cobra por API (ADR-011)');
    return;
  }
  if (!exes.claude) {
    record('Claude con la suscripción', 'SKIP', 'Sin CLI de Claude', 'Instala Claude Code CLI');
    return;
  }
  const r = run(exes.claude, ['-p', 'responde ok', '--output-format', 'json'], { timeout: 90000 });
  let detail = r.out.slice(0, 120);
  let ok = false;
  try {
    const json = JSON.parse(r.out);
    ok = r.ok && !json.is_error;
    detail = `respuesta: ${String(json.result ?? '').slice(0, 40)}; ${json.duration_ms ?? '?'} ms`;
  } catch {
    // La salida no es JSON: se informa tal cual.
  }
  record('Claude con la suscripción', ok ? 'PASS' : 'FAIL', detail, ok ? 'Confirma a mano que no aparece uso nuevo en la consola de API' : 'Corre "claude" e inicia sesión con tu cuenta Pro');
}

async function checkOllama() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    const { models = [] } = await res.json();
    if (models.length === 0) {
      record('Ollama', 'FAIL', 'Responde, pero sin modelos', 'ollama pull qwen2.5:3b (ADR-016)');
    } else {
      record('Ollama', 'PASS', models.map((m) => m.name).join(', '));
    }
  } catch {
    record('Ollama', 'FAIL', 'No responde en localhost:11434', 'Instala Ollama y ábrelo');
  }
}

function checkWiz() {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    const found = new Map();
    socket.on('message', (msg, rinfo) => {
      try {
        const { result } = JSON.parse(msg.toString());
        if (result?.mac) found.set(result.mac, rinfo.address);
      } catch {
        // Ignora respuestas que no son de WiZ.
      }
    });
    socket.on('error', (err) => {
      record('Luces WiZ', 'FAIL', err.message, 'Revisa el firewall de Windows para UDP 38899');
      socket.close();
      resolve();
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      // UDP pierde respuestas: se repite el broadcast y se acumulan las ampolletas que contesten.
      const msg = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }));
      for (const delay of [0, 500, 1000, 1500]) {
        setTimeout(() => socket.send(msg, 38899, '255.255.255.255'), delay);
      }
      setTimeout(() => {
        socket.close();
        if (found.size === 0) {
          record('Luces WiZ', 'FAIL', 'Ninguna ampolleta respondió en 3 s', 'Activa la comunicación local en la app WiZ y revisa que el PC esté en la misma red');
        } else {
          const list = [...found].map(([mac, ip]) => `${ip} (${mac})`).join(', ');
          record('Luces WiZ', 'PASS', `${found.size}: ${list}`);
        }
        resolve();
      }, 3000);
    });
  });
}

async function checkTv(config) {
  if (!config.tvIp) {
    record('TV Samsung', 'SKIP', 'Falta tvIp en vigia.local.json', 'Copia vigia.local.example.json a vigia.local.json con la IP de la TV');
    return;
  }
  try {
    const res = await fetch(`http://${config.tvIp}:8001/api/v2/`, { signal: AbortSignal.timeout(3000) });
    const json = await res.json();
    const os = json?.device?.OS;
    const model = json?.device?.modelName ?? '?';
    record('TV Samsung', os === 'Tizen' ? 'PASS' : 'FAIL', `OS ${os ?? '?'}, modelo ${model}`, os === 'Tizen' ? '' : 'No parece una TV Tizen');
  } catch {
    record('TV Samsung', 'FAIL', `Sin respuesta en ${config.tvIp}:8001`, 'Enciende la TV y confirma su IP');
  }
}

function checkBridge() {
  record('Teléfono alcanza al PC', 'SKIP', 'El puente LLM se construye en la fase 5', '');
}

const config = loadConfig();
checkTools();
checkPhone();
checkClaude();
await checkOllama();
await checkWiz();
await checkTv(config);
checkBridge();

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) {
  console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}${r.next ? `\n      → ${r.next}` : ''}`);
}
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n${results.length - failed} de ${results.length} sin fallos (${failed} fallidas).`);
process.exitCode = failed ? 1 : 0;
