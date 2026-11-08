import type { WidgetId } from '../../shared/widgets';
import type { SettingsController } from './useSettings';
import { WidgetPreview } from './WidgetPreview';

interface WidgetRowProps {
  id: WidgetId;
  title: string;
  enabled: boolean;
  controller: SettingsController;
  onCustomize(id: WidgetId): void;
}

export function WidgetRow({ id, title, enabled, controller, onCustomize }: WidgetRowProps) {
  return (
    <div className="settings-entry">
      <div className="min-w-0 flex-1">
        <div className="settings-label">{title}</div>
        <p className="settings-help">{enabled ? 'On desktop' : 'Hidden'}</p>
      </div>

      <WidgetPreview id={id} enabled={enabled} />

      <button type="button" className="settings-btn" onClick={() => onCustomize(id)}>
        Customize
      </button>

      <button
        type="button"
        className="settings-switch"
        role="switch"
        aria-checked={enabled}
        aria-label={`Show ${title}`}
        data-on={enabled}
        onClick={() => void controller.toggle(id, !enabled)}
      />
    </div>
  );
}
