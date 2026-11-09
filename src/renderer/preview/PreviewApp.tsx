import { useEffect, useRef, useState } from 'react';
import type { Appearance } from '../../shared/types';
import type { DockPreviewPayload } from '../../shared/dock';
import { applyTheme } from '../lib/theme';
import { ThumbCard } from './ThumbCard';

export function PreviewApp() {
  const [payload, setPayload] = useState<DockPreviewPayload | null>(null);
  const [entered, setEntered] = useState(false);
  /** Which app the card is currently animating in for; same-app updates must not replay it. */
  const animatedKey = useRef<string | null>(null);

  useEffect(() => {
    const bridge = window.widgets;

    const apply = (appearance: Appearance) => applyTheme(appearance.theme, appearance.resolvedTheme);

    bridge
      .getSettings()
      .then((snapshot) => applyTheme(snapshot.settings.theme, snapshot.resolvedTheme))
      .catch(() => {});
    bridge.getAppearance().then(apply).catch(() => {});

    const offPreview = bridge.onDockPreview((next) => {
      setPayload(next);
      // Animate on a new app (or the Wayland notice), not on the once-a-second
      // refresh of the same row.
      const key = next.appKey || '__notice__';
      if (animatedKey.current !== key) {
        animatedKey.current = key;
        setEntered(false);
        requestAnimationFrame(() => setEntered(true));
      }
    });

    const offClosed = bridge.onDockPreviewClosed(() => {
      animatedKey.current = null;
      setPayload(null);
    });

    // Ask for the payload that may have been broadcast before this effect ran.
    bridge.previewReady();

    return () => {
      offPreview();
      offClosed();
    };
  }, []);

  if (!payload) return null;

  if (!payload.x11) {
    return (
      <div className="dock-preview-row" data-entered={entered}>
        <div className="dock-preview-notice">
          <span className="dock-preview-notice-title">Window previews need X11</span>
          <span className="dock-preview-notice-body">
            This session is running on Wayland, so window thumbnails cannot be captured.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="dock-preview-row"
      data-entered={entered}
      onMouseEnter={() => {
        if (payload.appKey) window.widgets.previewEnter(payload.appKey);
      }}
      onMouseLeave={() => {
        if (payload.appKey) window.widgets.previewLeave(payload.appKey);
      }}
    >
      {payload.windows.map((item) => (
        <ThumbCard
          key={item.id}
          item={item}
          appIcon={payload.appIcon}
          appName={payload.appName}
          thumbWidth={payload.thumbWidth}
          thumbHeight={payload.thumbHeight}
          showClose={payload.showClose}
          onFocus={() => window.widgets.focusWindow(item.id)}
          onClose={() => window.widgets.closeWindow(item.id)}
        />
      ))}
    </div>
  );
}
