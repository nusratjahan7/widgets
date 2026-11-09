import { useEffect, useState } from 'react';
import { clipboardPanelConfig } from '../../shared/config/clipboardPanel';
import type { ConfigValue } from '../../shared/config/types';
import type {
  ClipboardPanelSettings,
  ClipboardPanelStatus,
} from '../../shared/clipboard-panel/types';
import type { SettingsSnapshot } from '../../shared/types';
import { Field } from './Field';
import type { SettingsController } from './useSettings';

interface ClipboardTabProps {
  snapshot: SettingsSnapshot;
  controller: SettingsController;
}

export function ClipboardTab({ snapshot }: ClipboardTabProps) {
  const panel = snapshot.settings.clipboardPanel;
  const [status, setStatus] = useState<ClipboardPanelStatus | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    window.widgets
      .getClipboardPanelStatus()
      .then((next) => setStatus(next))
      .catch(() => {});
  }, [panel.enabled, panel.historyEnabled]);

  const patch = (key: string, value: ConfigValue) => {
    void window.widgets.setSettings({
      clipboardPanel: { [key]: value } as Partial<ClipboardPanelSettings>,
    });
  };

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="settings-title">Clipboard</h1>
          <p className="settings-subtitle">
            The Win+V-style panel with emoji, GIFs, kaomoji, symbols, and clipboard history.
          </p>
        </div>
      </header>

      <div className="settings-panel px-4">
        {clipboardPanelConfig.map((field) => {
          const value = panel[field.key as keyof ClipboardPanelSettings];
          return (
            <Field
              key={field.key}
              field={field}
              value={value}
              onChange={(next) => patch(field.key, next)}
            />
          );
        })}
      </div>

      <div className="settings-panel px-4" style={{ marginTop: 14 }}>
        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Panel status</span>
              <p className="settings-help">
                Session {status?.session ?? '—'} · Watching {status?.clipboardWatch ? 'yes' : 'no'} ·
                Auto-paste {status?.pasteTool ?? 'unavailable'} · Tenor{' '}
                {status?.tenorConfigured ? 'configured' : 'not configured'}
              </p>
            </div>
            <button
              type="button"
              className="settings-btn"
              onClick={() => void window.widgets.toggleClipboardPanel()}
            >
              Toggle panel
            </button>
          </div>
        </div>

        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Clipboard history</span>
              <p className="settings-help">
                Stored locally in ~/.config/Widgets/clipboard-panel.json. Images live in the
                clipboard-panel-media folder next to it.
              </p>
            </div>
            <button
              type="button"
              className="settings-btn settings-btn-danger"
              disabled={clearing}
              onClick={async () => {
                setClearing(true);
                try {
                  await window.widgets.clearClipboardHistory();
                } finally {
                  setClearing(false);
                }
              }}
            >
              Clear history
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
