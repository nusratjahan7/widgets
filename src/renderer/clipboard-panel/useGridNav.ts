import { useEffect, useRef, useState } from 'react';

interface GridNavOptions {
  count: number;
  onActivate(index: number): void;
}

export function useGridNav({ count, onActivate }: GridNavOptions) {
  const [active, setActive] = useState(0);
  const [columns, setColumns] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const activateRef = useRef(onActivate);

  useEffect(() => {
    activateRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (active < count) return;
    setActive(count > 0 ? count - 1 : 0);
  }, [count, active]);

  useEffect(() => {
    const grid = containerRef.current;
    if (!grid) return;

    const update = () => {
      const template = getComputedStyle(grid).gridTemplateColumns;
      const next = template.split(' ').filter(Boolean).length;
      setColumns(Math.max(1, next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const moveTo = (target: number) => {
        event.preventDefault();
        if (count === 0) return;
        setActive(Math.max(0, Math.min(count - 1, target)));
      };

      switch (event.key) {
        case 'Enter':
          if (count > 0) {
            event.preventDefault();
            activateRef.current(Math.min(active, count - 1));
          }
          return;
        case 'ArrowRight':
          moveTo(active + 1);
          return;
        case 'ArrowLeft':
          moveTo(active - 1);
          return;
        case 'ArrowDown':
          moveTo(active + columns);
          return;
        case 'ArrowUp':
          moveTo(active - columns);
          return;
        case 'Home':
          moveTo(0);
          return;
        case 'End':
          moveTo(count - 1);
          return;
        case 'PageDown':
          moveTo(active + columns * 4);
          return;
        case 'PageUp':
          moveTo(active - columns * 4);
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, columns, count]);

  useEffect(() => {
    const element = containerRef.current?.querySelector<HTMLElement>(`[data-cp-index="${active}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return { active, setActive, containerRef };
}
