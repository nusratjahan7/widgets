import type { DockApp } from '../../shared/dock';

interface DockIconProps {
  app: DockApp;
  index: number;
  iconSize: number;
  scale: number;
  vertical: boolean;
  /** Bottom edge for the bottom dock; right edge for the right dock. */
  anchor: 'bottom' | 'right';
  focused: boolean;
  onEnter(index: number, element: HTMLElement): void;
  onLeave(index: number): void;
  onActivate(app: DockApp): void;
  onMenu(app: DockApp, event: React.MouseEvent): void;
}

export function DockIcon({
  app,
  index,
  iconSize,
  scale,
  vertical,
  anchor,
  focused,
  onEnter,
  onLeave,
  onActivate,
  onMenu,
}: DockIconProps) {
  const running = app.windows.length > 0;
  const count = app.windows.length;

  return (
    <button
      type="button"
      className="dock-item"
      data-vertical={vertical || undefined}
      data-running={running || undefined}
      title={app.name}
      aria-label={app.name}
      onMouseEnter={(event) => onEnter(index, event.currentTarget)}
      onMouseLeave={() => onLeave(index)}
      onClick={() => onActivate(app)}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(app, event);
      }}
    >
      <span
        className="dock-item-icon"
        data-bouncing={app.launching || undefined}
        style={{
          width: iconSize,
          height: iconSize,
          transform: `scale(${scale})`,
          transformOrigin: `center ${anchor}`,
        }}
      >
        {app.icon ? (
          <img src={app.icon} alt="" draggable={false} />
        ) : (
          <span className="dock-item-placeholder">{initials(app.name)}</span>
        )}
      </span>

      <span className="dock-item-indicator" data-vertical={vertical || undefined}>
        {running &&
          (focused ? (
            <span className="dock-indicator-bar" />
          ) : count > 1 ? (
            <span className="dock-indicator-count">{count > 9 ? '9+' : count}</span>
          ) : (
            <span className="dock-indicator-dot" />
          ))}
      </span>
    </button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
