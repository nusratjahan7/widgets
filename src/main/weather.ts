import { net } from 'electron';
import { readFileSync } from 'node:fs';
import type { WeatherSnapshot, WeatherUnits } from '../shared/types.js';
import { getSettings, store } from './settings.js';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MS = 10 * 60 * 1000;

interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

interface GeocodeResponse {
  results?: { name: string; admin1?: string; latitude: number; longitude: number }[];
}

interface ForecastResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
  };
  daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

let cached: { key: string; at: number; snapshot: WeatherSnapshot } | null = null;
let inFlight: Promise<WeatherSnapshot | null> | null = null;

/** Zero-config default: the city named by the machine's timezone. */
export function systemCity(): string {
  try {
    const zone = readFileSync('/etc/timezone', 'utf8').trim().split('\n')[0];
    const city = zone.split('/').pop();
    if (city) return city.replace(/_/g, ' ');
  } catch {
    // keep the fallback
  }
  return 'London';
}

export function ensureWeatherDefaults(): void {
  const weather = getSettings().weather;
  if (!weather.city) store.set('weather', { ...weather, city: systemCity() });
}

async function geocode(city: string): Promise<Place | null> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await net.fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status})`);

  const data = (await response.json()) as GeocodeResponse;
  const first = data.results?.[0];
  if (!first) return null;
  return {
    name: first.admin1 ? `${first.name}, ${first.admin1}` : first.name,
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

export async function setWeatherCity(city: string): Promise<Place | null> {
  const place = await geocode(city);
  if (!place) return null;

  store.set('weather', {
    ...getSettings().weather,
    city: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
  });
  cached = null;
  return place;
}

async function fetchForecast(place: Place, units: WeatherUnits): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  });
  if (units === 'imperial') params.set('temperature_unit', 'fahrenheit');

  const response = await net.fetch(`${FORECAST_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);

  const data = (await response.json()) as ForecastResponse;
  const current = data.current;
  const daily = data.daily;
  if (!current || !daily) throw new Error('Weather response was incomplete');

  return {
    city: place.name,
    temperature: Math.round(current.temperature_2m),
    apparent: Math.round(current.apparent_temperature),
    high: Math.round(daily.temperature_2m_max[0] ?? current.temperature_2m),
    low: Math.round(daily.temperature_2m_min[0] ?? current.temperature_2m),
    code: current.weather_code,
    isDay: current.is_day === 1,
    units,
    updatedAt: Date.now(),
  };
}

export async function getWeather(force = false): Promise<WeatherSnapshot | null> {
  const weather = getSettings().weather;
  const city = weather.city || systemCity();
  const key = `${city}|${weather.latitude}|${weather.longitude}|${weather.units}`;

  if (!force && cached && cached.key === key && Date.now() - cached.at < CACHE_MS) {
    return cached.snapshot;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const place =
        weather.latitude !== null && weather.longitude !== null
          ? { name: city, latitude: weather.latitude, longitude: weather.longitude }
          : await geocode(city);
      if (!place) return cached?.snapshot ?? null;

      if (weather.latitude === null) {
        store.set('weather', {
          ...weather,
          city: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        });
      }

      const snapshot = await fetchForecast(place, weather.units);
      cached = { key, at: Date.now(), snapshot };
      return snapshot;
    } catch (error) {
      console.error('[weather]', error);
      return cached?.snapshot ?? null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
