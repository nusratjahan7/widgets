import type { Settings, ThemeMode, WidgetBounds, WidgetState } from '../types.js';
import type { ClipboardPanelSettings } from '../clipboard-panel/types.js';
import { WIDGETS, WIDGET_IDS, type WidgetId } from '../widgets.js';
import { defaultConfig, isHexColor, isRecord, sanitizeConfig } from './values.js';

export const CLIPBOARD_PANEL_DEFAULTS: ClipboardPanelSettings = {
  enabled: true,
  historyEnabled: true,
  autoPaste: true,
  tenorApiKey: '',
};

export const DEFAULT_SETTINGS: Settings = {
  theme: { mode: 'dark', accent: '#8b7ed6' },
  locked: false,
  autostart: true,
  keepDockIcon: false,
  weather: { city: '', latitude: null, longitude: null, units: 'metric' },
  clipboardPanel: CLIPBOARD_PANEL_DEFAULTS,
  widgets: {},
};

const MODES: ThemeMode[] = ['dark', 'light', 'system'];

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function sanitizeWidgetState(id: WidgetId, raw: unknown): WidgetState | undefined {
  if (!isRecord(raw)) return undefined;

  const { x, y, width, height } = raw;
  if (!finite(x) || !finite(y) || !finite(width) || !finite(height)) return undefined;

  const definition = WIDGETS[id];
  return {
    x,
    y,
    width: Math.max(definition.minWidth, Math.round(width)),
    height: Math.max(definition.minHeight, Math.round(height)),
    visible: raw.visible !== false,
    config: sanitizeConfig(definition.config, raw.config),
  };
}

export function defaultWidgetState(id: WidgetId, bounds: WidgetBounds, visible = true): WidgetState {
  return { ...bounds, visible, config: defaultConfig(WIDGETS[id].config) };
}

export function sanitizeSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};
  const theme = isRecord(source.theme) ? source.theme : {};
  const weather = isRecord(source.weather) ? source.weather : {};
  const widgets = isRecord(source.widgets) ? source.widgets : {};
  const clipboardPanel = isRecord(source.clipboardPanel) ? source.clipboardPanel : {};

  const nextWidgets: Settings['widgets'] = {};
  for (const id of WIDGET_IDS) {
    const state = sanitizeWidgetState(id, widgets[id]);
    if (state) nextWidgets[id] = state;
  }

  return {
    theme: {
      mode: MODES.includes(theme.mode as ThemeMode) ? (theme.mode as ThemeMode) : DEFAULT_SETTINGS.theme.mode,
      accent: isHexColor(theme.accent) ? theme.accent.toLowerCase() : DEFAULT_SETTINGS.theme.accent,
    },
    locked: source.locked === true,
    autostart: typeof source.autostart === 'boolean' ? source.autostart : DEFAULT_SETTINGS.autostart,
    keepDockIcon: source.keepDockIcon === true,
    weather: {
      city: typeof weather.city === 'string' ? weather.city.trim().slice(0, 120) : '',
      latitude: finite(weather.latitude) ? weather.latitude : null,
      longitude: finite(weather.longitude) ? weather.longitude : null,
      units: weather.units === 'imperial' ? 'imperial' : 'metric',
    },
    clipboardPanel: {
      enabled: clipboardPanel.enabled !== false,
      historyEnabled: clipboardPanel.historyEnabled !== false,
      autoPaste: clipboardPanel.autoPaste !== false,
      tenorApiKey:
        typeof clipboardPanel.tenorApiKey === 'string'
          ? clipboardPanel.tenorApiKey.trim().slice(0, 200)
          : '',
    },
    widgets: nextWidgets,
  };
}
