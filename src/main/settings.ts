import Store from 'electron-store';
import { defaultConfig, sanitizeConfig } from '../shared/config/values.js';
import { DEFAULT_SETTINGS, sanitizeSettings, sanitizeWidgetState } from '../shared/config/settings.js';
import type { Settings, WidgetBounds, WidgetState } from '../shared/types.js';
import { WIDGETS, type WidgetId } from '../shared/widgets.js';

export const store = new Store<Settings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
  clearInvalidConfig: true,
});

/** Repairs missing/invalid values once at startup and persists the result. */
export function migrateSettings(): void {
  const current = store.store;
  const next = sanitizeSettings(current);
  if (JSON.stringify(current) !== JSON.stringify(next)) store.store = next;
}

export function getSettings(): Settings {
  return store.store;
}

export function readWidgetState(id: WidgetId): WidgetState | undefined {
  return sanitizeWidgetState(id, store.get('widgets')[id]);
}

export function defaultWidgetState(id: WidgetId, bounds: WidgetBounds, visible = true): WidgetState {
  return { ...bounds, visible, config: defaultConfig(WIDGETS[id].config) };
}

export function writeWidgetState(id: WidgetId, state: WidgetState): void {
  store.set('widgets', { ...store.get('widgets'), [id]: state });
}

export function patchWidgetState(id: WidgetId, patch: Partial<WidgetState>): void {
  const widgets = store.get('widgets');
  const current = widgets[id];
  if (!current) return;
  store.set('widgets', { ...widgets, [id]: { ...current, ...patch } });
}

export function getWidgetConfig(id: WidgetId): WidgetState['config'] {
  return readWidgetState(id)?.config ?? defaultConfig(WIDGETS[id].config);
}

/** Sanitizes and persists a config patch, returning the merged config. */
export function mergeWidgetConfig(id: WidgetId, patch: Record<string, unknown>): WidgetState['config'] {
  const merged = sanitizeConfig(WIDGETS[id].config, { ...getWidgetConfig(id), ...patch });
  patchWidgetState(id, { config: merged });
  return merged;
}

export function setWidgetVisible(id: WidgetId, visible: boolean): void {
  patchWidgetState(id, { visible });
}
