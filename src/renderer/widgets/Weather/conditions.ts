export type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'partly'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherCondition {
  label: string;
  icon: WeatherIconName;
}

/** WMO weather interpretation codes used by Open-Meteo. */
export function describeWeather(code: number, isDay: boolean): WeatherCondition {
  switch (code) {
    case 0:
      return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? 'sun' : 'moon' };
    case 1:
      return { label: 'Mainly clear', icon: 'sun' };
    case 2:
      return { label: 'Partly cloudy', icon: 'partly' };
    case 3:
      return { label: 'Overcast', icon: 'cloud' };
    case 45:
    case 48:
      return { label: 'Fog', icon: 'fog' };
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', icon: 'drizzle' };
    case 56:
    case 57:
      return { label: 'Freezing drizzle', icon: 'drizzle' };
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', icon: 'rain' };
    case 66:
    case 67:
      return { label: 'Freezing rain', icon: 'rain' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Snow', icon: 'snow' };
    case 80:
    case 81:
    case 82:
      return { label: 'Rain showers', icon: 'rain' };
    case 85:
    case 86:
      return { label: 'Snow showers', icon: 'snow' };
    case 95:
    case 96:
    case 99:
      return { label: 'Thunderstorm', icon: 'storm' };
    default:
      return { label: 'Unknown', icon: 'cloud' };
  }
}
