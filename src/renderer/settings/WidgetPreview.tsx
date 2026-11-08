import { useEffect, useState } from 'react';
import type { WidgetId } from '../../shared/widgets';

const REFRESH_MS = 2000;

interface WidgetPreviewProps {
  id: WidgetId;
  enabled: boolean;
}

export function WidgetPreview({ id, enabled }: WidgetPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSrc(null);
      return;
    }

    let alive = true;
    const tick = async () => {
      try {
        const next = await window.widgets.captureWidget(id);
        if (alive) setSrc(next);
      } catch {
        if (alive) setSrc(null);
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, enabled]);

  return (
    <div className="settings-preview">
      {src ? <img src={src} alt="" /> : <span>{enabled ? 'Loading…' : 'Hidden'}</span>}
    </div>
  );
}
