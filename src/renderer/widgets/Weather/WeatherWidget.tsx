import { WidgetFrame } from '../../components/WidgetFrame';
import { useWidgetContext } from '../../state/WidgetProvider';
import { describeWeather } from './conditions';
import { WeatherIcon } from './WeatherIcon';

export function WeatherWidget() {
  const { context, weather } = useWidgetContext();
  const condition = weather ? describeWeather(weather.code, weather.isDay) : null;

  return (
    <WidgetFrame className="flex flex-col justify-between p-[7cqw]">
      <div className="flex items-start justify-between gap-[4cqw]">
        <div className="min-w-0">
          <button
            type="button"
            className="weather-city"
            title="Change location"
            onClick={() => void window.widgets.openCityEditor()}
          >
            {weather?.city ?? context.weather.city ?? 'Locating…'}
          </button>

          <div className="weather-condition">{condition?.label ?? 'Loading…'}</div>
        </div>

        <WeatherIcon name={condition?.icon ?? 'cloud'} className="weather-icon" />
      </div>

      <div className="flex items-end justify-between gap-[3cqw]">
        <span className="weather-temp">{weather ? `${weather.temperature}°` : ''}</span>
        <span className="weather-range">{weather ? `H ${weather.high}°  L ${weather.low}°` : ''}</span>
      </div>
    </WidgetFrame>
  );
}
