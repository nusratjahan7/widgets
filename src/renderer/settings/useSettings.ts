import { useCallback, useEffect, useState } from 'react';
import type { SettingsPatch, SettingsSnapshot, WidgetUpdate, WidgetUpdateResult } from '../../shared/types';
import type { WidgetId } from '../../shared/widgets';
import { applyTheme } from '../lib/theme';

export interface SettingsController {
  snapshot: SettingsSnapshot | null;
  setSettings(patch: SettingsPatch): Promise<void>;
  toggle(id: WidgetId, enabled: boolean): Promise<void>;
  update(update: WidgetUpdate): Promise<WidgetUpdateResult>;
  reset(id?: WidgetId): Promise<void>;
}

export function useSettings(): SettingsController {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);

  useEffect(() => {
    let alive = true;

    window.widgets
      .getSettings()
      .then((next) => {
        if (alive) setSnapshot(next);
      })
      .catch((error: unknown) => console.error('[settings] load failed', error));

    const off = window.widgets.onSettingsSnapshot((next) => setSnapshot(next));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (snapshot) applyTheme(snapshot.settings.theme, snapshot.resolvedTheme);
  }, [snapshot]);

  const setSettings = useCallback(async (patch: SettingsPatch) => {
    setSnapshot(await window.widgets.setSettings(patch));
  }, []);

  const toggle = useCallback(async (id: WidgetId, enabled: boolean) => {
    setSnapshot(await window.widgets.toggleWidget(id, enabled));
  }, []);

  const update = useCallback(async (payload: WidgetUpdate) => {
    const result = await window.widgets.updateWidget(payload);
    setSnapshot(result.snapshot);
    return result;
  }, []);

  const reset = useCallback(async (id?: WidgetId) => {
    setSnapshot(await window.widgets.resetWidgets(id));
  }, []);

  return { snapshot, setSettings, toggle, update, reset };
}
