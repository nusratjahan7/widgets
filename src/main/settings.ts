import { app } from 'electron';
import Store from 'electron-store';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defaultConfig, sanitizeConfig } from '../shared/config/values.js';
import { DEFAULT_SETTINGS, sanitizeSettings, sanitizeWidgetState } from '../shared/config/settings.js';
import type { Settings, WidgetBounds, WidgetState } from '../shared/types.js';
import { WIDGETS, type WidgetId } from '../shared/widgets.js';

/**
 * productName changed from "Desktop Widgets" to "Widgets", which moves the
 * Electron userData directory. Copy the old settings over once so existing
 * installs keep their widgets and options.
 */
function migrateLegacySettings(): void {
  try {
    const targetDir = app.getPath('userData');
    const target = path.join(targetDir, 'settings.json');
    if (existsSync(target)) return;

    const legacy = path.join(app.getPath('appData'), 'Desktop Widgets', 'settings.json');
    if (!existsSync(legacy)) return;

    mkdirSync(targetDir, { recursive: true });
    copyFileSync(legacy, target);
    console.log('[settings] migrated settings from the previous userData directory');
  } catch (error) {
    console.warn('[settings] legacy settings migration skipped:', error);
  }
}

migrateLegacySettings();

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
