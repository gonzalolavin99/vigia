import {DeviceConfig, DeviceError, Net, TvAdapter} from './types';

// TV Samsung Tizen por WebSocket seguro local, puerto 8002 (ADR-014). La primera conexión muestra un aviso en la
// TV; al aceptarlo entrega un token que se guarda para las siguientes. Para encender desde apagado: Wake-on-LAN.
const NAME_B64 = 'VmlnaWE='; // "Vigia" en base64: así aparece en la TV.
const PAIR_WAIT_MS = 30_000; // tiempo para aceptar el aviso en la TV la primera vez
const KEY_WAIT_MS = 2500;

type PowerState = 'on' | 'standby' | 'off';

export class SamsungAdapter implements TvAdapter {
  constructor(private readonly net: Net, private readonly sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {}

  async power(device: DeviceConfig, on: boolean): Promise<void> {
    const state = await this.state(device);
    if (on) {
      if (state === 'on') return;
      // En reposo de red la TV aún acepta teclas: KEY_POWER la enciende. Apagada del todo, solo despierta por WoL.
      // Sin emparejar, la TV en reposo no responde (espera que alguien acepte el aviso con la pantalla apagada).
      if (!(await this.paired(device))) throw new DeviceError(device, 'unpaired');
      if (state === 'standby') { await this.send(device, ['KEY_POWER']); return; }
      await this.net.wakeOnLan(device.mac);
      for (let i = 0; i < 10; i++) {
        await this.sleep(1500);
        const now = await this.state(device);
        if (now === 'on') return;
        if (now === 'standby') { await this.send(device, ['KEY_POWER']); return; }
      }
      throw new DeviceError(device, 'unreachable');
    }
    if (state !== 'on') return;
    await this.send(device, ['KEY_POWER']);
  }

  /** Emparejar a propósito ("conecta la tele"): con la TV encendida aparece el aviso para aceptar. */
  async pair(device: DeviceConfig): Promise<void> {
    if ((await this.state(device)) !== 'on') throw new DeviceError(device, 'unreachable');
    await this.send(device, []);
  }

  async paired(device: DeviceConfig): Promise<boolean> {
    return (await this.net.kvGet(`samsung-token-${device.mac}`)) !== null;
  }

  async key(device: DeviceConfig, key: 'KEY_VOLUP' | 'KEY_VOLDOWN' | 'KEY_MUTE', times = 1): Promise<void> {
    if ((await this.state(device)) !== 'on') throw new DeviceError(device, 'unreachable');
    await this.send(device, Array(times).fill(key));
  }

  /** Estado por la API REST de la TV (https en el 8002); sin respuesta = apagada o fuera de la red. */
  async state(device: DeviceConfig): Promise<PowerState> {
    if (!device.ip) return 'off';
    const body = await this.net.httpGet(`https://${device.ip}:8002/api/v2/`, 2500);
    if (!body) return 'off';
    try {
      return JSON.parse(body)?.device?.PowerState === 'standby' ? 'standby' : 'on';
    } catch {
      return 'on';
    }
  }

  private async send(device: DeviceConfig, keys: string[]): Promise<void> {
    const tokenKey = `samsung-token-${device.mac}`;
    const token = await this.net.kvGet(tokenKey);
    const url = `wss://${device.ip}:8002/api/v2/channels/samsung.remote.control?name=${NAME_B64}${token ? `&token=${token}` : ''}`;
    const messages = keys.map(key => JSON.stringify({
      method: 'ms.remote.control',
      params: {Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey'},
    }));
    const replies = (await this.net.ws(url, messages, token ? KEY_WAIT_MS : PAIR_WAIT_MS, true)).map(parse);
    const connect = replies.find(r => r?.event === 'ms.channel.connect');
    if (connect?.data?.token) this.net.kvSet(tokenKey, String(connect.data.token));
    if (replies.some(r => r?.event === 'ms.channel.unauthorized')) throw new DeviceError(device, 'unauthorized');
    if (!connect) throw new DeviceError(device, 'unreachable');
  }
}

function parse(text: string): {event?: string; data?: {token?: string}} | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
