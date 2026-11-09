import { useEffect, useState } from 'react';
import type { PanelUseRequest } from '../../../shared/clipboard-panel/types';
import data from '../data/kaomoji.json';
import { useGridNav } from '../useGridNav';

interface Group {
  id: string;
  label: string;
  items: string[];
}

const groups = (data as { groups: Group[] }).groups;

interface KaomojiTabProps {
  onUse(request: PanelUseRequest): void;
}

export function KaomojiTab({ onUse }: KaomojiTabProps) {
  const [category, setCategory] = useState(0);
  const group = groups[category];
  const items = group?.items ?? [];

  const { active, setActive, containerRef } = useGridNav({
    count: items.length,
    onActivate: (index) => {
      const value = items[index];
      if (!value) return;
      onUse({ source: 'kaomoji', value, label: group?.label ?? 'Kaomoji' });
    },
  });

  useEffect(() => {
    setActive(0);
  }, [category, setActive]);

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">{group?.label ?? 'Kaomoji'}</span>
        <span className="cp-count">{items.length} faces</span>
      </div>

      <div className="cp-pills">
        {groups.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className="cp-pill"
            data-active={index === category}
            onClick={() => setCategory(index)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="cp-scroll">
        <div ref={containerRef} className="cp-grid cp-grid-kaomoji">
          {items.map((value, index) => (
            <button
              key={`${value}:${index}`}
              type="button"
              className="cp-cell cp-kaomoji"
              data-cp-index={index}
              data-active={index === active}
              title={value}
              onClick={() => onUse({ source: 'kaomoji', value, label: group?.label ?? 'Kaomoji' })}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-footer">
        <span>Grouped by mood</span>
        <span>Enter to copy</span>
      </div>
    </>
  );
}
