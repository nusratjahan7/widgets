import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useWidgetContext } from '../state/WidgetProvider';

interface WidgetFrameProps {
  children: ReactNode;
  className?: string;
}

const INTERACTIVE = 'button, input, a, [data-no-drag]';

function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WidgetFrame({ children, className = '' }: WidgetFrameProps) {
  const { context } = useWidgetContext();
  const start = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  const config = context.config;
  const accent = typeof config.accent === 'string' && config.accent !== 'auto' ? config.accent : null;
  const textColor =
    typeof config.textColor === 'string' && config.textColor !== 'auto' ? config.textColor : null;
  const opacity = typeof config.opacity === 'number' ? config.opacity : 1;
  const radius = typeof config.radius === 'number' ? config.radius : 26;
  const background = typeof config.background === 'string' ? config.background : 'auto';

  const style = {
    ...(accent ? { '--accent': accent } : {}),
    ...(textColor ? { '--fg': textColor } : {}),
    '--widget-opacity': String(opacity),
    '--widget-radius': `${radius}px`,
  } as CSSProperties;

  function flush() {
    frame.current = null;
    const point = pending.current;
    if (point) window.widgets.dragTo(point.x, point.y);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (context.locked || event.button !== 0) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.screenX, y: event.screenY };
    window.widgets.startDrag(event.screenX, event.screenY);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    pending.current = { x: event.screenX, y: event.screenY };
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    start.current = null;
    pending.current = null;

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    window.widgets.endDrag();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={`card ${className}`}
      data-bg={background}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <button
        type="button"
        className="widget-gear"
        data-no-drag
        title="Widget settings"
        aria-label="Widget settings"
        onClick={() => void window.widgets.openSettings()}
      >
        <Gear />
      </button>
      {children}
    </div>
  );
}
