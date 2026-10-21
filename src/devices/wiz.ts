import {DeviceConfig, DeviceError, LightAdapter, Net} from './types';

// Luces WiZ por UDP local en el puerto 38899 (ADR-013). Si la IP configurada cambió (DHCP), se busca la ampolleta
// por su MAC con un broadcast y se recuerda la IP nueva.
const PORT = 38899;
const WAIT_MS = 1500;

export class WizAdapter implements LightAdapter {
  private ips = new Map<string, string>();

  constructor(private readonly net: Net, private readonly broadcast = '255.255.255.255') {}

  async setPower(device: DeviceConfig, on: boolean): Promise<void> {
    await this.pilot(device, {state: on});
  }

  async setBrightness(device: DeviceConfig, percent: number): Promise<void> {
    await this.pilot(device, {state: true, dimming: Math.round(Math.min(100, Math.max(10, percent)))});
  }

  async setWhite(device: DeviceConfig, kelvin: number): Promise<void> {
    await this.pilot(device, {state: true, temp: Math.round(Math.min(6500, Math.max(2200, kelvin)))});
  }

  async brightness(device: DeviceConfig): Promise<number | null> {
    try {
      const result = await this.call(device, 'getPilot', {});
      return result?.state ? Number(result.dimming ?? 100) : 0;
    } catch {
      return null;
    }
  }

  private async pilot(device: DeviceConfig, params: Record<string, unknown>): Promise<void> {
    const result = await this.call(device, 'setPilot', params);
    if (!result?.success) throw new DeviceError(device, 'failed');
  }

  private async call(device: DeviceConfig, method: string, params: Record<string, unknown>): Promise<Record<string, any> | null> {
    const payload = JSON.stringify({method, params});
    const known = this.ips.get(device.mac) ?? device.ip;
    if (known) {
      const replies = await this.net.udp(known, PORT, payload, WAIT_MS);
      const reply = replies.map(r => parse(r.payload)).find(Boolean);
      if (reply) return reply.result ?? null;
    }
    const ip = await this.find(device);
    if (!ip) throw new DeviceError(device, 'unreachable');
    const reply = (await this.net.udp(ip, PORT, payload, WAIT_MS)).map(r => parse(r.payload)).find(Boolean);
    if (!reply) throw new DeviceError(device, 'unreachable');
    return reply.result ?? null;
  }

  /** Broadcast getPilot: cada ampolleta responde con su MAC. */
  private async find(device: DeviceConfig): Promise<string | null> {
    const replies = await this.net.udp(this.broadcast, PORT, JSON.stringify({method: 'getPilot', params: {}}), 2500);
    for (const r of replies) {
      const mac = parse(r.payload)?.result?.mac;
      if (mac) this.ips.set(String(mac).toLowerCase(), r.from);
    }
    return this.ips.get(device.mac.toLowerCase()) ?? null;
  }
}

function parse(payload: string): {result?: Record<string, any>} | null {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
