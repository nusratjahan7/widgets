import { useEffect, useMemo, useState } from 'react';
import type { PanelUseRequest } from '../../../shared/clipboard-panel/types';
import { emojiGroups, searchEmoji, SKIN_TONES, withSkinTone, type Emoji, type SkinTone } from '../data/emoji';
import { useGridNav } from '../useGridNav';

interface EmojiTabProps {
  query: string;
  onUse(request: PanelUseRequest): void;
}

function glyphFor(item: Emoji, tone: SkinTone): string {
  return item.supportsTone ? withSkinTone(item.char, tone) : item.char;
}

export function EmojiTab({ query, onUse }: EmojiTabProps) {
  const [category, setCategory] = useState(0);
  const [tone, setTone] = useState<SkinTone>(SKIN_TONES[0]);

  const searching = query.trim().length > 0;
  const items = useMemo(
    () => (searching ? searchEmoji(query) : (emojiGroups[category]?.emojis ?? [])),
    [searching, query, category],
  );

  const { active, setActive, containerRef } = useGridNav({
    count: items.length,
    onActivate: (index) => {
      const item = items[index];
      if (!item) return;
      onUse({ source: 'emoji', value: glyphFor(item, tone), label: item.name });
    },
  });

  useEffect(() => {
    setActive(0);
  }, [category, query, setActive]);

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">
          {searching ? 'Emoji results' : (emojiGroups[category]?.name ?? 'Emoji')}
        </span>
        <div className="cp-tones" aria-label="Skin tone">
          {SKIN_TONES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="cp-tone"
              data-active={tone.id === option.id}
              title={option.label}
              aria-label={`${option.label} skin tone`}
              aria-pressed={tone.id === option.id}
              onClick={() => setTone(option)}
            >
              {option.glyph}
            </button>
          ))}
        </div>
      </div>

      {!searching && (
        <div className="cp-pills">
          {emojiGroups.map((group, index) => (
            <button
              key={group.name}
              type="button"
              className="cp-pill"
              data-active={index === category}
              onClick={() => setCategory(index)}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      <div className="cp-scroll">
        {items.length === 0 ? (
          <div className="cp-empty">
            <span className="cp-empty-title">No emoji found</span>
            <span className="cp-empty-body">Try a word like &ldquo;heart&rdquo;, &ldquo;cat&rdquo;, or &ldquo;star&rdquo;.</span>
          </div>
        ) : (
          <div ref={containerRef} className="cp-grid cp-grid-emoji">
            {items.map((item, index) => {
              const glyph = glyphFor(item, tone);
              return (
                <button
                  key={`${item.char}:${item.name}:${index}`}
                  type="button"
                  className="cp-cell cp-emoji"
                  data-cp-index={index}
                  data-active={index === active}
                  title={item.name}
                  onClick={() => onUse({ source: 'emoji', value: glyph, label: item.name })}
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="cp-footer">
        <span>{items.length} emoji</span>
        <span>Enter to copy</span>
      </div>
    </>
  );
}
