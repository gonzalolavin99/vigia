// Temperatura exterior por Open-Meteo, gratis y sin API key (ADR-017). Se guarda 10 minutos.
const CACHE_MS = 10 * 60_000;

export type Weather = {temperature: number; feelsLike: number; description: string};
type Fetch = (url: string) => Promise<{ok: boolean; json(): Promise<any>}>;

// Códigos WMO que entrega Open-Meteo, en palabras.
export function describe(code: number): string {
  if (code === 0) return 'despejado';
  if (code <= 2) return 'parcialmente nublado';
  if (code === 3) return 'nublado';
  if (code === 45 || code === 48) return 'con niebla';
  if (code >= 51 && code <= 57) return 'con llovizna';
  if (code >= 61 && code <= 67) return 'lloviendo';
  if (code >= 71 && code <= 77) return 'nevando';
  if (code >= 80 && code <= 82) return 'con chubascos';
  if (code >= 95) return 'con tormenta';
  return '';
}

export class OpenMeteo {
  private cache: {at: number; value: Weather} | null = null;

  constructor(
    private readonly latitude: number,
    private readonly longitude: number,
    private readonly fetchFn: Fetch = (url: string) => fetch(url),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async current(): Promise<Weather | null> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}`
      + '&current=temperature_2m,apparent_temperature,weather_code&timezone=America%2FSantiago';
    try {
      const response = await this.fetchFn(url);
      if (!response.ok) return null;
      const c = (await response.json()).current;
      const value = {temperature: c.temperature_2m, feelsLike: c.apparent_temperature, description: describe(c.weather_code)};
      this.cache = {at: this.now(), value};
      return value;
    } catch {
      return null;
    }
  }
}
