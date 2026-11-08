import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SystemStats, WeatherSnapshot, WidgetContext } from '../../shared/types';
import type { WidgetId } from '../../shared/widgets';
import { applyTheme } from '../lib/theme';

interface WidgetStateValue {
  context: WidgetContext;
  stats: SystemStats | null;
  weather: WeatherSnapshot | null;
}

const WidgetStateContext = createContext<WidgetStateValue | null>(null);

export function WidgetProvider({ id, children }: { id: WidgetId; children: ReactNode }) {
  const [context, setContext] = useState<WidgetContext | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const bridge = window.widgets;

    bridge
      .getContext()
      .then((next) => {
        if (alive) setContext(next);
      })
      .catch((error: unknown) => console.error('[widget] context failed', error));

    bridge
      .getStats()
      .then((next) => {
        if (alive) setStats(next);
      })
      .catch(() => {});

    if (id === 'weather') {
      bridge
        .getWeather()
        .then((next) => {
          if (alive) setWeather(next);
        })
        .catch(() => {});
    }

    const offSettings = bridge.onSettings((next) => setContext(next));
    const offStats = bridge.onStats((next) => setStats(next));
    const offWeather = bridge.onWeather((next) => setWeather(next));

    return () => {
      alive = false;
      offSettings();
      offStats();
      offWeather();
    };
  }, [id]);

  useEffect(() => {
    if (context) applyTheme(context.theme, context.resolvedTheme);
  }, [context]);

  const value = useMemo(
    () => (context ? { context, stats, weather } : null),
    [context, stats, weather],
  );

  if (!value) return null;
  return <WidgetStateContext.Provider value={value}>{children}</WidgetStateContext.Provider>;
}

export function useWidgetContext(): WidgetStateValue {
  const value = useContext(WidgetStateContext);
  if (!value) throw new Error('useWidgetContext must be used inside WidgetProvider');
  return value;
}
