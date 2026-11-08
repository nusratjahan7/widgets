import type { SettingsSnapshot } from '../../shared/types';
import type { SettingsController } from './useSettings';

interface GeneralTabProps {
  snapshot: SettingsSnapshot;
  controller: SettingsController;
}

export function GeneralTab({ snapshot, controller }: GeneralTabProps) {
  const { autostart, locked } = snapshot.settings;

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="settings-title">General</h1>
          <p className="settings-subtitle">Settings that affect the app as a whole.</p>
        </div>
      </header>

      <div className="settings-panel px-4">
        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Start at login</span>
              <p className="settings-help">Launch Desktop Widgets when you sign in.</p>
            </div>
            <button
              type="button"
              className="settings-switch"
              role="switch"
              aria-checked={autostart}
              aria-label="Start at login"
              data-on={autostart}
              onClick={() => void controller.setSettings({ autostart: !autostart })}
            />
          </div>
        </div>

        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Lock all positions</span>
              <p className="settings-help">Disables dragging and resizing for every widget.</p>
            </div>
            <button
              type="button"
              className="settings-switch"
              role="switch"
              aria-checked={locked}
              aria-label="Lock all positions"
              data-on={locked}
              onClick={() => void controller.setSettings({ locked: !locked })}
            />
          </div>
        </div>

        <div className="settings-field">
          <div className="settings-field-head">
            <div>
              <span className="settings-label">Reload widgets</span>
              <p className="settings-help">Recreate every widget window without restarting the app.</p>
            </div>
            <button type="button" className="settings-btn" onClick={() => void window.widgets.reloadWidgets()}>
              Reload
            </button>
          </div>
        </div>

        <div className="settings-field">
          <span className="settings-label">Settings file</span>
          <p className="settings-help">Stored in ~/.config/Desktop Widgets/settings.json</p>
        </div>
      </div>
    </>
  );
}
