import { useEffect, useMemo, useRef, useState } from 'react';
import type { PanelRecentItem, PanelUseRequest } from '../../../shared/clipboard-panel/types';

interface RecentTabProps {
  recents: PanelRecentItem[];
  onUse(request: PanelUseRequest): void;
}

const SECTION_ORDER = [
  { kind: 'emoji', title: 'Emoji', columns: 9 },
  { kind: 'symbol', title: 'Symbols', columns: 9 },
  { kind: 'kaomoji', title: 'Kaomoji', columns: 2 },
  { kind: 'gif', title: 'GIF', columns: 3 },
] as const;

interface Section {
  kind: PanelRecentItem['kind'];
  title: string;
  columns: number;
  items: PanelRecentItem[];
  start: number;
}

function activateItem(item: PanelRecentItem, onUse: (request: PanelUseRequest) => void): void {
  if (item.kind === 'gif') {
    onUse({ source: 'gif', url: item.value, label: item.label });
    return;
  }
  onUse({ source: item.kind, value: item.value, label: item.label });
}

export function RecentTab({ recents, onUse }: RecentTabProps) {
  const sections = useMemo<Section[]>(() => {
    let start = 0;
    return SECTION_ORDER.flatMap((definition): Section[] => {
      const items = recents.filter((item) => item.kind === definition.kind);
      if (items.length === 0) return [];
      const section: Section = { ...definition, items, start };
      start += items.length;
      return [section];
    });
  }, [recents]);

  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active < items.length) return;
    setActive(items.length > 0 ? items.length - 1 : 0);
  }, [items.length, active]);

  useEffect(() => {
    if (items.length === 0) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const moveTo = (target: number) => {
        event.preventDefault();
        setActive(Math.max(0, Math.min(items.length - 1, target)));
      };

      const section =
        sections.find(
          (entry) => active >= entry.start && active < entry.start + entry.items.length,
        ) ?? sections[0];
      const sectionEnd = section.start + section.items.length - 1;

      switch (event.key) {
        case 'Enter': {
          event.preventDefault();
          const item = items[Math.min(active, items.length - 1)];
          if (item) activateItem(item, onUse);
          return;
        }
        case 'ArrowRight':
          moveTo(active + 1);
          return;
        case 'ArrowLeft':
          moveTo(active - 1);
          return;
        case 'ArrowDown':
          moveTo(Math.min(sectionEnd, active + section.columns));
          return;
        case 'ArrowUp':
          moveTo(Math.max(section.start, active - section.columns));
          return;
        case 'Home':
          moveTo(0);
          return;
        case 'End':
          moveTo(items.length - 1);
          return;
        case 'PageDown':
          moveTo(Math.min(sectionEnd, active + section.columns * 4));
          return;
        case 'PageUp':
          moveTo(Math.max(section.start, active - section.columns * 4));
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items, sections, onUse]);

  useEffect(() => {
    const element = containerRef.current?.querySelector<HTMLElement>(`[data-cp-index="${active}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">Recent</span>
        <span className="cp-count">{recents.length}/30 used</span>
      </div>

      <div className="cp-scroll cp-scroll-recent">
        {items.length === 0 ? (
          <div className="cp-empty">
            <span className="cp-empty-title">Nothing here</span>
            <span className="cp-empty-body">
              You&rsquo;ll see the emoji, symbols, kaomoji, and GIFs you use most recently here.
            </span>
          </div>
        ) : (
          <div ref={containerRef} className="cp-recent">
            {sections.map((section) => (
              <section
                key={section.kind}
                className="cp-recent-section"
                data-kind={section.kind}
                aria-label={section.title}
              >
                <h2 className="cp-recent-heading">{section.title}</h2>
                <div className="cp-recent-grid">
                  {section.items.map((item, offset) => {
                    const index = section.start + offset;
                    const activate = () => activateItem(item, onUse);
                    const key = `${item.kind}:${item.value}`;

                    if (item.kind === 'gif') {
                      return (
                        <button
                          key={key}
                          type="button"
                          className="cp-gif cp-recent-cell"
                          data-cp-index={index}
                          data-active={index === active}
                          title={item.label}
                          onClick={activate}
                        >
                          <img src={item.value} alt={item.label} loading="lazy" draggable={false} />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={key}
                        type="button"
                        className={`cp-cell cp-recent-cell ${
                          item.kind === 'kaomoji'
                            ? 'cp-kaomoji'
                            : item.kind === 'emoji'
                              ? 'cp-emoji'
                              : 'cp-symbol'
                        }`}
                        data-cp-index={index}
                        data-active={index === active}
                        title={item.label}
                        onClick={activate}
                      >
                        {item.value}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="cp-footer">
        <span>Recently used</span>
        <span>Enter to copy</span>
      </div>
    </>
  );
}
