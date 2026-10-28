// Configuración de la casa y contratos de los adaptadores (fase 4, ADR-007 y ADR-020).

export type DeviceConfig = {
  id: string;
  /** Cómo lo nombra Gonzalo: "luz cocina", "tele". */
  name: string;
  kind: 'light' | 'tv';
  brand: 'wiz' | 'samsung';
  mac: string;
  ip?: string;
  /** Pieza: "cocina", "living". */
  zone: string;
  /** Grupos mayores: "casa". */
  groups: string[];
};

export type HomeConfig = {latitude: number; longitude: number; place?: string; devices: DeviceConfig[];
  /** Puente LLM del PC (fase 5); sin él, Vigía funciona solo con reglas. */
  bridge?: {url: string; token: string}};

/** Red genérica que entrega Android (ADR-020); en las pruebas se reemplaza por una falsa. */
export interface Net {
  udp(host: string, port: number, payload: string, waitMs: number): Promise<{from: string; payload: string}[]>;
  wakeOnLan(mac: string): Promise<void>;
  ws(url: string, messages: string[], waitMs: number, insecureLocal: boolean): Promise<string[]>;
  httpGet(url: string, waitMs: number): Promise<string | null>;
  kvGet(key: string): Promise<string | null>;
  kvSet(key: string, value: string): void;
}

/** Una implementación por marca (docs/arquitectura.md, "Contratos"). */
export interface LightAdapter {
  setPower(device: DeviceConfig, on: boolean): Promise<void>;
  /** 10–100 %. */
  setBrightness(device: DeviceConfig, percent: number): Promise<void>;
  /** Kelvin: 2700 cálida … 6500 fría. */
  setWhite(device: DeviceConfig, kelvin: number): Promise<void>;
  /** Brillo actual o null si no responde. */
  brightness(device: DeviceConfig): Promise<number | null>;
}

export interface TvAdapter {
  power(device: DeviceConfig, on: boolean): Promise<void>;
  key(device: DeviceConfig, key: 'KEY_VOLUP' | 'KEY_VOLDOWN' | 'KEY_MUTE', times?: number): Promise<void>;
  pair(device: DeviceConfig): Promise<void>;
}

export class DeviceError extends Error {
  constructor(readonly device: DeviceConfig, readonly reason: 'unreachable' | 'unauthorized' | 'unpaired' | 'failed') {
    super(`${device.name}: ${reason}`);
  }
}
