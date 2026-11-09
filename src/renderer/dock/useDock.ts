import { useEffect, useState } from 'react';
import type { Appearance } from '../../shared/types';
import type { DockSnapshot } from '../../shared/dock';
import { applyTheme } from '../lib/theme';

export function useDock(): DockSnapshot | null {
  const [snapshot, setSnapshot] = useState<DockSnapshot | null>(null);

  useEffect(() => {
    const bridge = window.widgets;

    const apply = (appearance: Appearance) => applyTheme(appearance.theme, appearance.resolvedTheme);

    bridge
      .getSettings()
      .then((settings) => applyTheme(settings.settings.theme, settings.resolvedTheme))
      .catch(() => {});
    bridge.getAppearance().then(apply).catch(() => {});

    const offWindows = bridge.onDockWindows((next) => {
      setSnapshot((current) => (current && current.revision === next.revision ? current : next));
    });

    bridge.refreshDock();

    return () => offWindows();
  }, []);

  return snapshot;
}
