import { useMemo } from 'react';
import {
  mediaUrlFor,
  type ClipboardHistoryItem,
  type PanelUseRequest,
} from '../../../shared/clipboard-panel/types';
import { useGridNav } from '../useGridNav';

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3h6l-1.2 5 3.2 3v2H7v-2l3.2-3L9 3z" />
      <path d="M12 13v8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 7h15M9 7V4.6h6V7M7 7l.8 13h8.4L17 7M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface HistoryTabProps {
  history: ClipboardHistoryItem[];
  onUse(request: PanelUseRequest): void;
  onDelete(id: string): void;
  onPin(id: string, pinned: boolean): void;
  onClear(): void;
}

export function HistoryTab({ history, onUse, onDelete, onPin, onClear }: HistoryTabProps) {
  const items = useMemo(
    () =>
      [...history].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
      ),
    [history],
  );

  const { active, containerRef } = useGridNav({
    count: items.length,
    onActivate: (index) => {
      const item = items[index];
      if (item) onUse({ source: 'history', id: item.id });
    },
  });

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">Clipboard</span>
        <div className="cp-head-actions">
          <span className="cp-count">{items.length}/50</span>
          <button
            type="button"
            className="cp-clear"
            disabled={items.length === 0}
            onClick={onClear}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="cp-scroll">
        {items.length === 0 ? (
          <div className="cp-empty">
            <span className="cp-empty-title">Nothing here</span>
            <span className="cp-empty-body">
              You&rsquo;ll see your clipboard history here once you&rsquo;ve copied something.
            </span>
          </div>
        ) : (
          <div ref={containerRef} className="cp-list">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="cp-item"
                data-cp-index={index}
                data-active={index === active}
                role="button"
                tabIndex={-1}
                onClick={() => onUse({ source: 'history', id: item.id })}
              >
                <div className="cp-item-main">
                  {item.kind === 'image' ? (
                    <img
                      className="cp-item-image"
                      src={mediaUrlFor(item)}
                      alt="Copied image"
                      draggable={false}
                    />
                  ) : (
                    <span className="cp-item-text">{item.text}</span>
                  )}
                </div>

                <div className="cp-item-meta">
                  <span className="cp-item-time">{formatTime(item.createdAt)}</span>
                  <div className="cp-item-actions">
                    <button
                      type="button"
                      className="cp-icon-btn"
                      data-on={item.pinned}
                      aria-label={item.pinned ? 'Unpin' : 'Pin'}
                      title={item.pinned ? 'Unpin' : 'Pin'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPin(item.id, !item.pinned);
                      }}
                    >
                      <PinIcon />
                    </button>
                    <button
                      type="button"
                      className="cp-icon-btn"
                      aria-label="Delete"
                      title="Delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cp-footer">
        <span>{items.filter((item) => item.pinned).length} pinned</span>
        <span>Enter to paste</span>
      </div>
    </>
  );
}
