import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import type { ResizeEdge } from '../../shared/types';
import { useWidgetContext } from '../state/WidgetProvider';

interface WidgetFrameProps {
  children: ReactNode;
  className?: string;
  onActivate?: () => void;
  style?: CSSProperties;
}

const INTERACTIVE = 'button, input, a, [data-no-drag]';

const RESIZE_EDGES: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

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

export function WidgetFrame({ children, className = '', onActivate, style: extraStyle }: WidgetFrameProps) {
  const { context } = useWidgetContext();
  const start = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const resizing = useRef(false);

  const config = context.config;
  const accent = typeof config.accent === 'string' && config.accent !== 'auto' ? config.accent : null;
  const textColor =
    typeof config.textColor === 'string' && config.textColor !== 'auto' ? config.textColor : null;
  const opacity = typeof config.opacity === 'number' ? config.opacity : 1;
  const radius = typeof config.radius === 'number' ? config.radius : 26;
  const background = typeof config.background === 'string' ? config.background : 'auto';

  const style = {
    ...extraStyle,
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
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;

    tap.current = { x: event.screenX, y: event.screenY };
    if (context.locked) return;

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
    const tapStart = tap.current;
    tap.current = null;
    if (
      tapStart &&
      event.type === 'pointerup' &&
      Math.hypot(event.screenX - tapStart.x, event.screenY - tapStart.y) < 4
    ) {
      onActivate?.();
    }

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

  function onResizeStart(event: PointerEvent<HTMLDivElement>, edge: ResizeEdge) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizing.current = true;
    window.widgets.startResize(edge, event.screenX, event.screenY);
  }

  function onResizeMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;
    event.preventDefault();
    window.widgets.resizeTo(event.screenX, event.screenY);
  }

  function onResizeEnd(event: PointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;

    resizing.current = false;
    window.widgets.endResize();
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
      {!context.locked &&
        RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            className="resize-handle"
            data-edge={edge}
            data-no-drag
            onPointerDown={(event) => onResizeStart(event, edge)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
          />
        ))}
      {children}
    </div>
  );
}
