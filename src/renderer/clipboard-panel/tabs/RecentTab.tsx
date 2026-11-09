import type { PanelRecentItem, PanelUseRequest } from '../../../shared/clipboard-panel/types';
import { useGridNav } from '../useGridNav';

interface RecentTabProps {
  recents: PanelRecentItem[];
  onUse(request: PanelUseRequest): void;
}

export function RecentTab({ recents, onUse }: RecentTabProps) {
  const { active, containerRef } = useGridNav({
    count: recents.length,
    onActivate: (index) => {
      const item = recents[index];
      if (!item) return;
      onUse({ source: item.kind, value: item.value, label: item.label });
    },
  });

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">Recent</span>
        <span className="cp-count">{recents.length}/30 used</span>
      </div>

      <div className="cp-scroll">
        {recents.length === 0 ? (
          <div className="cp-empty">
            <span className="cp-empty-title">Nothing here</span>
            <span className="cp-empty-body">
              You&rsquo;ll see the emoji, symbols, and kaomoji you use most recently here.
            </span>
          </div>
        ) : (
          <div ref={containerRef} className="cp-grid cp-grid-emoji">
            {recents.map((item, index) => (
              <button
                key={`${item.kind}:${item.value}`}
                type="button"
                className="cp-cell cp-emoji"
                data-cp-index={index}
                data-active={index === active}
                title={item.label}
                onClick={() => onUse({ source: item.kind, value: item.value, label: item.label })}
              >
                {item.value}
              </button>
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
