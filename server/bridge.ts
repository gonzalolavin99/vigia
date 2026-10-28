/// <reference types="node" />
// Puente LLM en el PC (fase 5, ADR-011 y ADR-016). Node 24 ejecuta este archivo directo: `npm run bridge`.
// Escucha solo en la IP de la red local, exige la clave de vigia.local.json y llama a `claude -p` con el plan Pro,
// sin herramientas ni contexto de Claude Code (773 tokens por llamada en vez de 267 mil, 28 oct). Si Claude falla,
// usa Ollama local. Nunca con ANTHROPIC_API_KEY: con ella Claude Code cobraría por API.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolve, type ResolveRequest, type Runner} from './core.ts';

if (process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY está definida: Claude Code cobraría por API en vez de usar el plan Pro (ADR-011). Bórrala y vuelve a iniciar.');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'vigia.local.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!config.bridgeToken) {
  config.bridgeToken = randomBytes(24).toString('hex');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Generé bridgeToken en vigia.local.json; corre `npm run push-config` para pasárselo al teléfono.');
}
const PORT = Number(config.bridgePort ?? 8787);
const HOST = config.bridgeHost ?? lanAddress();
const MODEL = config.bridgeModel ?? 'haiku';
const OLLAMA_MODEL = config.ollamaModel ?? 'qwen2.5:3b';
const CLAUDE = config.claudePath ?? 'G:\\Dev\\npm-global\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe';
// Carpeta vacía como directorio de trabajo: así Claude Code no carga el CLAUDE.md ni la configuración de ningún proyecto.
const WORKDIR = 'G:\\Dev\\vigia-bridge';
mkdirSync(WORKDIR, {recursive: true});
const LOGS = join(root, 'server', 'logs');
mkdirSync(LOGS, {recursive: true});

const claude: Runner = (system, prompt, schema) => new Promise((ok, fail) => {
  const args = ['-p', prompt, '--model', MODEL, '--output-format', 'json', '--json-schema', JSON.stringify(schema),
    '--system-prompt', system, '--tools', '', '--no-session-persistence',
    // Sin skills, conectores ni configuración del usuario: el contexto baja de ~267 mil a ~800 tokens.
    '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', 'project', '--exclude-dynamic-system-prompt-sections'];
  const env = {...process.env};
  delete env.ANTHROPIC_API_KEY;
  const child = spawn(CLAUDE, args, {cwd: WORKDIR, env, windowsHide: true});
  let out = '';
  child.stdout.on('data', d => (out += d));
  const timer = setTimeout(() => { child.kill(); fail(new Error('timeout')); }, 25_000);
  child.on('error', e => { clearTimeout(timer); fail(e); });
  child.on('close', () => {
    clearTimeout(timer);
    try {
      const d = JSON.parse(out);
      if (d.is_error) return fail(new Error(String(d.result)));
      log(`claude model=${MODEL} ms=${d.duration_ms} tokens_in=${(d.usage?.input_tokens ?? 0) + (d.usage?.cache_creation_input_tokens ?? 0) + (d.usage?.cache_read_input_tokens ?? 0)} tokens_out=${d.usage?.output_tokens}`);
      ok(d.structured_output ?? d.result);
    } catch (e) { fail(e as Error); }
  });
});

const ollama: Runner = async (system, prompt, schema) => {
  const request = fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({model: OLLAMA_MODEL, stream: false, format: schema, options: {temperature: 0},
      messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]}),
  });
  const timeout = new Promise<never>((_, fail) => setTimeout(() => fail(new Error('timeout')), 20_000));
  const res = await Promise.race([request, timeout]);
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  log(`ollama model=${OLLAMA_MODEL}`);
  const data = (await res.json()) as {message?: {content?: string}};
  return data.message?.content;
};

const server = createServer(async (req, res) => {
  const reply = (status: number, body: unknown) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${config.bridgeToken}`) return reply(401, {error: 'unauthorized'});
  if (req.method === 'GET' && req.url === '/health') return reply(200, {ok: true, model: MODEL});
  if (req.method !== 'POST' || req.url !== '/v1/resolve') return reply(404, {error: 'not found'});
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    const request = JSON.parse(body) as ResolveRequest;
    const result = await resolve(request, claude, ollama);
    log(`resolve text="${request.text}" -> ${result ? `${result.source} tool=${result.tool} ms=${result.ms}` : 'sin respuesta'}`);
    reply(result ? 200 : 503, result ?? {error: 'no model available'});
  } catch (e) {
    reply(400, {error: (e as Error).message});
  }
});

server.listen(PORT, HOST, () => console.log(`Puente Vigía en http://${HOST}:${PORT} (Claude ${MODEL}, respaldo Ollama ${OLLAMA_MODEL})`));

function lanAddress(): string {
  const all = Object.values(networkInterfaces()).flat().filter(Boolean);
  return all.find(a => a!.family === 'IPv4' && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a!.address))?.address ?? '127.0.0.1';
}

function log(line: string) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  appendFileSync(join(LOGS, `bridge-${day}.log`), `${new Date().toISOString()} ${line}\n`);
}

if (!existsSync(CLAUDE)) console.warn(`No encuentro claude en ${CLAUDE}; solo funcionará Ollama.`);
