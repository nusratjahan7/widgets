import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DockApp as DockAppModel, DockRect, DockSettings } from '../../shared/dock';
import { DockIcon } from './DockIcon';
import { useDock } from './useDock';
import { useMagnification } from './useMagnification';

const ROW_PADDING = 10;
const ITEM_GAP = 8;
const ITEM_PADDING = 4;

export function DockApp() {
  const snapshot = useDock();
  const [settings, setSettings] = useState<DockSettings | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const reported = useRef({ width: 0, height: 0 });

  useEffect(() => {
    window.widgets
      .getSettings()
      .then((next) => setSettings(next.settings.dock))
      .catch(() => {});
    return window.widgets.onSettingsSnapshot((next) => setSettings(next.settings.dock));
  }, []);

  const zoom = settings?.zoom ?? 1.6;
  const iconSize = settings?.iconSize ?? 48;
  const vertical = settings?.position === 'left' || settings?.position === 'right';
  const anchor = settings?.position === 'right' ? 'right' : 'bottom';

  const { setHovered, scaleFor } = useMagnification(zoom);
  const apps = snapshot?.apps ?? [];

  /** The dock window is sized to its content, so report the measured row. */
  const reportSize = useCallback(() => {
    const element = rowRef.current;
    if (!element) return;

    const width = Math.ceil(element.scrollWidth + ROW_PADDING * 2);
    const height = Math.ceil(element.scrollHeight + ROW_PADDING * 2);

    if (Math.abs(width - reported.current.width) < 1 && Math.abs(height - reported.current.height) < 1) return;
    reported.current = { width, height };
    window.widgets.reportDockSize(width, height);
  }, []);

  useLayoutEffect(() => {
    reportSize();
    const element = rowRef.current;
    if (!element) return;

    const observer = new ResizeObserver(reportSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reportSize, apps.length, iconSize, zoom, vertical]);

  const handleEnter = useCallback(
    (index: number, element: HTMLElement) => {
      setHovered(index);
      const app = apps[index];
      if (!app) return;
      window.widgets.hoverStart(app.key, screenRectOf(element));
    },
    [apps, setHovered],
  );

  const handleLeave = useCallback(
    (index: number) => {
      setHovered(null);
      const app = apps[index];
      if (app) window.widgets.hoverEnd(app.key);
    },
    [apps, setHovered],
  );

  const handleActivate = useCallback((app: DockAppModel) => {
    if (app.windows.length === 0) {
      window.widgets.launchApp(app.key);
      return;
    }
    // Clicking a running app with one window focuses it; several windows open the
    // preview row instead, which is where the per-window choice lives.
    if (app.windows.length === 1) {
      window.widgets.focusWindow(app.windows[0].id);
      return;
    }
    const element = document.querySelector<HTMLElement>(`[data-dock-key="${cssEscape(app.key)}"]`);
    if (element) window.widgets.hoverStart(app.key, screenRectOf(element));
  }, []);

  const handleMenu = useCallback((app: DockAppModel, event: React.MouseEvent) => {
    // `Menu.popup` expects screen coordinates, not client coordinates.
    window.widgets.openDockMenu(
      app.key,
      Math.round(window.screenX + event.clientX),
      Math.round(window.screenY + event.clientY),
    );
  }, []);

  return (
    <div className="dock-root" data-vertical={vertical || undefined} data-anchor={anchor}>
      <div
        ref={rowRef}
        className="dock-row"
        data-vertical={vertical || undefined}
        style={{ gap: ITEM_GAP, padding: ITEM_PADDING }}
      >
        {apps.map((app, index) => (
          <div key={app.key} data-dock-key={app.key} className="dock-slot">
            <DockIcon
              app={app}
              index={index}
              iconSize={iconSize}
              scale={scaleFor(index)}
              vertical={vertical}
              anchor={anchor}
              focused={snapshot?.focusedKey === app.key}
              onEnter={handleEnter}
              onLeave={handleLeave}
              onActivate={handleActivate}
              onMenu={handleMenu}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Converts a DOM rect into screen coordinates (Electron reports both in DIPs). */
function screenRectOf(element: HTMLElement): DockRect {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(window.screenX + rect.left),
    y: Math.round(window.screenY + rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}
