import type { ComponentType } from 'react';
import { isWidgetId, type WidgetId } from '../shared/widgets';
import { WidgetProvider } from './state/WidgetProvider';
import { CalendarWidget } from './widgets/Calendar/CalendarWidget';
import { ClockWidget } from './widgets/Clock/ClockWidget';
import { DateCardWidget } from './widgets/DateCard/DateCardWidget';
import { SystemStatsWidget } from './widgets/SystemStats/SystemStatsWidget';
import { WeatherWidget } from './widgets/Weather/WeatherWidget';

const RENDERERS: Record<WidgetId, ComponentType> = {
  clock: ClockWidget,
  dateCard: DateCardWidget,
  calendar: CalendarWidget,
  systemStats: SystemStatsWidget,
  weather: WeatherWidget,
};

export function App() {
  const id = new URLSearchParams(window.location.search).get('widget');

  if (!isWidgetId(id)) {
    return <div className="p-4 font-mono text-xs text-red-400">Unknown widget: {id ?? 'none'}</div>;
  }

  const Widget = RENDERERS[id];
  return (
    <WidgetProvider id={id}>
      <Widget />
    </WidgetProvider>
  );
}
