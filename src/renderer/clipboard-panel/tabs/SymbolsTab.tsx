import { useEffect, useState } from 'react';
import type { PanelUseRequest } from '../../../shared/clipboard-panel/types';
import { CategoryPills } from '../CategoryPills';
import data from '../data/symbols.json';
import { useGridNav } from '../useGridNav';

interface Group {
  id: string;
  label: string;
  items: string[];
}

const groups = (data as { groups: Group[] }).groups;

interface SymbolsTabProps {
  onUse(request: PanelUseRequest): void;
}

export function SymbolsTab({ onUse }: SymbolsTabProps) {
  const [category, setCategory] = useState(0);
  const group = groups[category];
  const items = group?.items ?? [];

  const { active, setActive, containerRef } = useGridNav({
    count: items.length,
    onActivate: (index) => {
      const value = items[index];
      if (!value) return;
      onUse({ source: 'symbol', value, label: group?.label ?? 'Symbol' });
    },
  });

  useEffect(() => {
    setActive(0);
  }, [category, setActive]);

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">{group?.label ?? 'Symbols'}</span>
        <span className="cp-count">{items.length} symbols</span>
      </div>

      <CategoryPills
        items={groups}
        active={category}
        label="Symbol categories"
        onSelect={setCategory}
      />

      <div className="cp-scroll">
        <div ref={containerRef} className="cp-grid cp-grid-symbol">
          {items.map((value, index) => (
            <button
              key={`${value}:${index}`}
              type="button"
              className="cp-cell cp-symbol"
              data-cp-index={index}
              data-active={index === active}
              title={value}
              onClick={() => onUse({ source: 'symbol', value, label: group?.label ?? 'Symbol' })}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-footer">
        <span>Grouped by kind</span>
        <span>Enter to copy</span>
      </div>
    </>
  );
}
