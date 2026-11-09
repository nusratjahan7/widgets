import type { DockPreviewWindow } from '../../shared/dock';

interface ThumbCardProps {
  item: DockPreviewWindow;
  appIcon: string;
  appName: string;
  thumbWidth: number;
  thumbHeight: number;
  showClose: boolean;
  onFocus(): void;
  onClose(): void;
}

export function ThumbCard({
  item,
  appIcon,
  appName,
  thumbWidth,
  thumbHeight,
  showClose,
  onFocus,
  onClose,
}: ThumbCardProps) {
  return (
    <div
      className="dock-thumb"
      role="button"
      tabIndex={-1}
      title={item.title}
      style={{ width: thumbWidth }}
      onClick={onFocus}
      // Middle-click closes the window, matching the Windows 11 behaviour asked for.
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onFocus();
      }}
    >
      <div
        className="dock-thumb-frame"
        style={{ height: thumbHeight }}
        data-placeholder={item.thumbnail ? undefined : 'true'}
      >
        {item.thumbnail ? (
          <img className="dock-thumb-image" src={item.thumbnail} alt="" draggable={false} />
        ) : (
          <div className="dock-thumb-fallback">
            {appIcon ? <img src={appIcon} alt="" draggable={false} /> : <span>{initials(appName)}</span>}
            {item.minimized && <span className="dock-thumb-minimized">Minimized</span>}
          </div>
        )}

        {showClose && (
          <button
            type="button"
            className="dock-thumb-close"
            aria-label={`Close ${item.title}`}
            title="Close window"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.6 1.6 L8.4 8.4 M8.4 1.6 L1.6 8.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="dock-thumb-meta">
        {appIcon && <img className="dock-thumb-appicon" src={appIcon} alt="" draggable={false} />}
        <span className="dock-thumb-title">{item.title || appName}</span>
      </div>
    </div>
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
