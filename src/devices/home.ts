import {normalize} from '../nlu/normalize';
import {DeviceConfig, DeviceError, HomeConfig, LightAdapter, TvAdapter} from './types';
import {OpenMeteo} from './weather';

// La casa: traduce lo que dice Gonzalo ("la luz de la cocina", "las luces del living", "todo") a dispositivos
// de home.json, y ejecuta la acción en el adaptador de cada marca.
//   singular ("la luz de la cocina") → la luz con ese nombre; plural ("las luces de la cocina") → la zona;
//   "todo", "la casa", "todas las luces" → el grupo casa.

export type LightTarget = {target?: string};
export type Outcome = {done: DeviceConfig[]; failed: DeviceError[]};

export class Home {
  readonly weather: OpenMeteo;

  constructor(readonly config: HomeConfig, private readonly lights: LightAdapter, private readonly tv: TvAdapter, weather?: OpenMeteo) {
    this.weather = weather ?? new OpenMeteo(config.latitude, config.longitude);
  }

  get allLights(): DeviceConfig[] {
    return this.config.devices.filter(d => d.kind === 'light');
  }

  get television(): DeviceConfig | undefined {
    return this.config.devices.find(d => d.kind === 'tv');
  }

  /**
   * Luces a las que se refiere el texto. [] = no se sabe cuál (se pregunta); null = no es una luz conocida.
   */
  resolveLights(target: string | undefined): DeviceConfig[] | null {
    const text = normalize(target ?? '');
    const lights = this.allLights;
    if (!text || /^(la |el )?(luz|lampara|ampolleta)$/.test(text)) return lights.length === 1 ? lights : [];
    const groups = new Set(lights.flatMap(d => d.groups));
    if (/\b(todo|todas?|toda la casa)\b/.test(text) || [...groups].some(g => new RegExp(`\\b${g}\\b`).test(text))) {
      return lights;
    }
    const plural = /\b(luces|lamparas|ampolletas)\b/.test(text);
    const byName = lights.filter(d => nameKey(d).every(word => new RegExp(`\\b${word}\\b`).test(text)));
    const byZone = lights.filter(d => new RegExp(`\\b${normalize(d.zone)}\\b`).test(text));
    if (plural && byZone.length) return byZone;
    if (byName.length) return byName;
    if (byZone.length) return byZone;
    if (plural && /^(las )?(luces|lamparas|ampolletas)$/.test(text)) return lights;
    return null;
  }

  async setLights(devices: DeviceConfig[], action: (adapter: LightAdapter, d: DeviceConfig) => Promise<void>): Promise<Outcome> {
    const results = await Promise.allSettled(devices.map(d => action(this.lights, d)));
    const outcome: Outcome = {done: [], failed: []};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') outcome.done.push(devices[i]);
      else outcome.failed.push(r.reason instanceof DeviceError ? r.reason : new DeviceError(devices[i], 'failed'));
    });
    return outcome;
  }

  async tvPower(on: boolean): Promise<void> {
    const tv = this.requireTv();
    await this.tv.power(tv, on);
  }

  async tvKey(key: 'KEY_VOLUP' | 'KEY_VOLDOWN' | 'KEY_MUTE', times = 1): Promise<void> {
    await this.tv.key(this.requireTv(), key, times);
  }

  private requireTv(): DeviceConfig {
    const tv = this.television;
    if (!tv) throw new Error('No hay TV configurada');
    return tv;
  }
}

/** Palabras que distinguen una luz por su nombre: "luz cocina" → ["cocina"]. */
function nameKey(device: DeviceConfig): string[] {
  return normalize(device.name).split(' ').filter(w => !/^(luz|lampara|ampolleta|de|del|la|el)$/.test(w));
}

/** "la luz cocina", "las 3 luces de la casa": para las respuestas. */
export function describeLights(devices: DeviceConfig[], all: DeviceConfig[]): string {
  if (devices.length === all.length && all.length > 1) return `las ${all.length} luces de la casa`;
  if (devices.length === 1) return `la ${devices[0].name}`;
  const zone = devices.every(d => d.zone === devices[0].zone) ? ` de la ${devices[0].zone}` : '';
  return `las ${devices.length} luces${zone}`;
}
