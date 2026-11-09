import { useRef, type PointerEvent, type ReactNode } from 'react';
import type { PanelTab } from '../../shared/clipboard-panel/types';

export const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'gif', label: 'GIF' },
  { id: 'kaomoji', label: 'Kaomoji' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'history', label: 'Clipboard history' },
];

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function TabIcon({ id }: { id: PanelTab }) {
  switch (id) {
    case 'recent':
      return (
        <Svg>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.4V12l3 1.8" />
        </Svg>
      );
    case 'emoji':
      return (
        <Svg>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.6 9.7h.01M15.4 9.7h.01M8.4 13.9c.9 1.4 2.2 2.1 3.6 2.1s2.7-.7 3.6-2.1" />
        </Svg>
      );
    case 'gif':
      return <span className="cp-tab-text">GIF</span>;
    case 'kaomoji':
      return <span className="cp-tab-text">;-)</span>;
    case 'symbols':
      return <span className="cp-tab-text">±∑</span>;
    case 'history':
      return (
        <Svg>
          <rect x="5.2" y="4.4" width="13.6" height="16" rx="2.2" />
          <path d="M9 4.4h6v2.6H9zM8.6 11h6.8M8.6 14.6h6.8M8.6 18.2h4.4" />
        </Svg>
      );
  }
}

function CloseIcon() {
  return (
    <Svg>
      <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" />
    </Svg>
  );
}

interface TabsProps {
  tab: PanelTab;
  onChange(tab: PanelTab): void;
}

export function Tabs({ tab, onChange }: TabsProps) {
  const dragPointer = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    dragPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    window.widgets.startPanelDrag(event.screenX, event.screenY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragPointer.current !== event.pointerId) return;
    window.widgets.dragPanelTo(event.screenX, event.screenY);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragPointer.current !== event.pointerId) return;
    dragPointer.current = null;
    window.widgets.endPanelDrag();
  };

  return (
    <div
      className="cp-tabs"
      role="tablist"
      aria-label="Clipboard panel sections"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {PANEL_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="cp-tab"
          data-active={tab === item.id}
          aria-selected={tab === item.id}
          aria-label={item.label}
          title={item.label}
          onClick={() => onChange(item.id)}
        >
          <TabIcon id={item.id} />
        </button>
      ))}

      <span className="cp-spacer" />

      <button
        type="button"
        className="cp-tab cp-close"
        aria-label="Close panel"
        title="Close (Esc)"
        onClick={() => window.widgets.hideClipboardPanel()}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
