import { useEffect, useRef, type KeyboardEvent, type WheelEvent } from 'react';

export interface CategoryPill {
  id: string;
  label: string;
}

interface CategoryPillsProps {
  items: readonly CategoryPill[];
  active: number;
  label: string;
  onSelect(index: number): void;
}

export function CategoryPills({ items, active, label, onSelect }: CategoryPillsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number, focus: boolean) => {
    if (items.length === 0) return;
    const next = ((index % items.length) + items.length) % items.length;
    onSelect(next);
    if (!focus) return;
    const button = buttonsRef.current[next];
    button?.focus();
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  useEffect(() => {
    const button = containerRef.current?.querySelector<HTMLElement>('.cp-pill[data-active="true"]');
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.currentTarget.scrollLeft += event.deltaY;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        select(active - 1, true);
        return;
      case 'ArrowRight':
        event.preventDefault();
        select(active + 1, true);
        return;
      case 'Home':
        event.preventDefault();
        select(0, true);
        return;
      case 'End':
        event.preventDefault();
        select(items.length - 1, true);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown':
      case 'Enter':
      case ' ':
        // Keep the grid's global navigation from also reacting while a chip has focus.
        event.stopPropagation();
        return;
      default:
        return;
    }
  };

  return (
    <div
      ref={containerRef}
      className="cp-pills"
      role="group"
      aria-label={label}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            buttonsRef.current[index] = node;
          }}
          type="button"
          className="cp-pill"
          data-active={index === active}
          aria-pressed={index === active}
          tabIndex={index === active ? 0 : -1}
          onFocus={() => select(index, false)}
          onClick={() => select(index, false)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
