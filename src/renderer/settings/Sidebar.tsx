import { Mark } from '../components/Mark';

export type SettingsTab = 'widgets' | 'clipboard' | 'appearance' | 'general';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'widgets', label: 'Widgets' },
  { id: 'clipboard', label: 'Clipboard' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'general', label: 'General' },
];

interface SidebarProps {
  tab: SettingsTab;
  onSelect(tab: SettingsTab): void;
}

export function Sidebar({ tab, onSelect }: SidebarProps) {
  return (
    <aside className="settings-sidebar">
      <div className="settings-brand">
        <Mark className="h-6 w-6" />
        <span>Desktop Widgets</span>
      </div>

      <nav className="settings-nav">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="settings-nav-item"
            data-active={tab === item.id}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
