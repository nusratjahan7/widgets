import type { SettingsSnapshot } from '../../shared/types';
import { WIDGETS, WIDGET_IDS, type WidgetId } from '../../shared/widgets';
import type { SettingsController } from './useSettings';
import { WidgetRow } from './WidgetRow';

interface WidgetsTabProps {
  snapshot: SettingsSnapshot;
  controller: SettingsController;
  onCustomize(id: WidgetId): void;
}

export function WidgetsTab({ snapshot, controller, onCustomize }: WidgetsTabProps) {
  const states = snapshot.settings.widgets;

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="settings-title">Widgets</h1>
          <p className="settings-subtitle">Show, hide, and fine-tune the widgets on your desktop.</p>
        </div>
        <button type="button" className="settings-btn" onClick={() => void controller.reset()}>
          Reset to default
        </button>
      </header>

      <div className="settings-panel">
        {WIDGET_IDS.map((id) => (
          <WidgetRow
            key={id}
            id={id}
            title={WIDGETS[id].title}
            enabled={states[id]?.visible !== false}
            controller={controller}
            onCustomize={onCustomize}
          />
        ))}
      </div>
    </>
  );
}
