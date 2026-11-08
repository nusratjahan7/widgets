import { ACCENTS, ACCENT_NAMES } from '../../shared/palette';
import type { SettingsSnapshot, ThemeMode } from '../../shared/types';
import type { SettingsController } from './useSettings';

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'System' },
];

interface AppearanceTabProps {
  snapshot: SettingsSnapshot;
  controller: SettingsController;
}

export function AppearanceTab({ snapshot, controller }: AppearanceTabProps) {
  const theme = snapshot.settings.theme;

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="settings-title">Appearance</h1>
          <p className="settings-subtitle">Theme and accent for the widgets and this window.</p>
        </div>
      </header>

      <div className="settings-panel px-4">
        <div className="settings-field">
          <span className="settings-label">Theme</span>
          <div className="settings-controls">
            <div className="settings-seg">
              {MODES.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  className="settings-seg-btn"
                  data-active={theme.mode === mode}
                  onClick={() => void controller.setSettings({ theme: { mode } })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-field">
          <span className="settings-label">Accent</span>
          <p className="settings-help">Used by every widget unless a widget overrides it.</p>
          <div className="settings-controls settings-swatches">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                className="settings-swatch"
                data-active={theme.accent.toLowerCase() === accent}
                title={ACCENT_NAMES[accent] ?? accent}
                aria-label={ACCENT_NAMES[accent] ?? accent}
                style={{ background: accent }}
                onClick={() => void controller.setSettings({ theme: { accent } })}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
