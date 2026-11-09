import { useEffect, useState } from 'react';
import { dockConfig } from '../../shared/config/dock';
import type { ConfigValue } from '../../shared/config/types';
import type { DockSettings, DockStatus } from '../../shared/dock';
import type { SettingsSnapshot } from '../../shared/types';
import { Field } from './Field';
import type { SettingsController } from './useSettings';

interface DockTabProps {
  snapshot: SettingsSnapshot;
  controller: SettingsController;
}

export function DockTab({ snapshot }: DockTabProps) {
  const dock = snapshot.settings.dock;
  const [status, setStatus] = useState<DockStatus | null>(null);
  const [plankBusy, setPlankBusy] = useState(false);

  useEffect(() => {
    window.widgets
      .getDockStatus()
      .then((next) => setStatus(next))
      .catch(() => {});
  }, []);

  const patch = (key: string, value: ConfigValue) => {
    void window.widgets.setSettings({ dock: { [key]: value } as Partial<DockSettings> });
  };

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="settings-title">Dock</h1>
          <p className="settings-subtitle">
            The app dock at the screen edge, with window previews on hover.
          </p>
        </div>
      </header>

      {status && !status.x11 && (
        <div className="settings-callout">
          Window previews need an X11 session. This session reports <code>{status.session}</code>, so
          thumbnails are unavailable and the dock falls back to app icons.
        </div>
      )}

      {status && status.x11 && !status.strut && (
        <div className="settings-callout">
          Space reservation is unavailable, so maximized windows will cover the dock. Turn on
          Auto-hide above to work around it.
        </div>
      )}

      <div className="settings-panel px-4">
        {dockConfig.map((field) => {
          const value = dock[field.key as keyof DockSettings];
          return (
            <Field
              key={field.key}
              field={field}
              value={typeof value === 'object' ? field.default : value}
              onChange={(next) => patch(field.key, next)}
            />
          );
        })}
      </div>

      <div className="settings-panel px-4" style={{ marginTop: 14 }}>
        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Dock status</span>
              <p className="settings-help">
                Session {status?.session ?? '—'} · X11 {status?.x11 ? 'yes' : 'no'} · Space
                reservation {status?.strut ? 'active' : 'unavailable'}
              </p>
            </div>
            <button type="button" className="settings-btn" onClick={() => window.widgets.revealDock()}>
              Reveal dock
            </button>
          </div>
        </div>

        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Plank</span>
              <p className="settings-help">
                The previous dock. Stopping it frees the screen edge; starting it restores your old
                dock and leaves this one running too.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="settings-btn"
                disabled={plankBusy}
                onClick={async () => {
                  setPlankBusy(true);
                  try {
                    await window.widgets.stopPlank();
                  } finally {
                    setPlankBusy(false);
                  }
                }}
              >
                Stop Plank
              </button>
              <button
                type="button"
                className="settings-btn"
                disabled={plankBusy}
                onClick={async () => {
                  setPlankBusy(true);
                  try {
                    await window.widgets.restartPlank();
                  } finally {
                    setPlankBusy(false);
                  }
                }}
              >
                Start Plank
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
