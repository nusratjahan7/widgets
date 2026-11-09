import { useState } from 'react';
import { WIDGETS, type WidgetId } from '../../shared/widgets';
import { AppearanceTab } from './AppearanceTab';
import { ClipboardTab } from './ClipboardTab';
import { DockTab } from './DockTab';
import { GeneralTab } from './GeneralTab';
import { Sidebar, type SettingsTab } from './Sidebar';
import { useSettings } from './useSettings';
import { WidgetCustomize } from './WidgetCustomize';
import { WidgetsTab } from './WidgetsTab';

export function SettingsApp() {
  const controller = useSettings();
  const [tab, setTab] = useState<SettingsTab>('widgets');
  const [customizing, setCustomizing] = useState<WidgetId | null>(null);

  const { snapshot } = controller;

  if (!snapshot) return <div className="settings-root" />;

  return (
    <div className="settings-root">
      <Sidebar
        tab={tab}
        onSelect={(next) => {
          setTab(next);
          setCustomizing(null);
        }}
      />

      <main className="settings-main">
        {customizing ? (
          <WidgetCustomize
            key={customizing}
            id={customizing}
            definition={WIDGETS[customizing]}
            state={snapshot.settings.widgets[customizing]}
            onBack={() => setCustomizing(null)}
            controller={controller}
          />
        ) : tab === 'widgets' ? (
          <WidgetsTab snapshot={snapshot} controller={controller} onCustomize={setCustomizing} />
        ) : tab === 'dock' ? (
          <DockTab snapshot={snapshot} controller={controller} />
        ) : tab === 'clipboard' ? (
          <ClipboardTab snapshot={snapshot} controller={controller} />
        ) : tab === 'appearance' ? (
          <AppearanceTab snapshot={snapshot} controller={controller} />
        ) : (
          <GeneralTab snapshot={snapshot} controller={controller} />
        )}
      </main>
    </div>
  );
}
