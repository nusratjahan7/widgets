import { useEffect, useState } from 'react';
import type { PanelUseRequest, TenorResult } from '../../../shared/clipboard-panel/types';
import { useGridNav } from '../useGridNav';

type LoadState = 'loading' | 'ready' | 'no-key' | 'error';

interface GifTabProps {
  query: string;
  onUse(request: PanelUseRequest): void;
}

export function GifTab({ query, onUse }: GifTabProps) {
  const [results, setResults] = useState<TenorResult[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('Could not reach Tenor.');

  useEffect(() => {
    let alive = true;
    setState('loading');

    const timer = setTimeout(() => {
      window.widgets
        .searchTenor(query)
        .then((result) => {
          if (!alive) return;

          if (!result.ok) {
            setResults([]);
            if (result.error === 'no-key') {
              setState('no-key');
            } else {
              setError(
                result.error === 'network'
                  ? 'Could not reach Tenor. Check the connection.'
                  : 'Tenor returned an error. Check the API key.',
              );
              setState('error');
            }
            return;
          }

          setResults(result.results);
          setState('ready');
        })
        .catch(() => {
          if (!alive) return;
          setResults([]);
          setError('Could not reach Tenor.');
          setState('error');
        });
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const { active, setActive, containerRef } = useGridNav({
    count: results.length,
    onActivate: (index) => {
      const item = results[index];
      if (!item) return;
      onUse({ source: 'gif', url: item.url, label: item.title });
    },
  });

  useEffect(() => {
    setActive(0);
  }, [query, setActive]);

  return (
    <>
      <div className="cp-head">
        <span className="cp-title">{query.trim() ? 'GIF results' : 'Trending GIFs'}</span>
        <span className="cp-count">{results.length}</span>
      </div>

      <div className="cp-scroll">
        {state === 'no-key' && (
          <div className="cp-notice">
            Add a Tenor API key in <strong>Settings → Clipboard</strong> to browse and search GIFs.
          </div>
        )}

        {state === 'loading' && <div className="cp-loading">Loading GIFs…</div>}

        {state === 'error' && <div className="cp-notice cp-error">{error}</div>}

        {state === 'ready' && results.length === 0 && (
          <div className="cp-empty">
            <span className="cp-empty-title">No GIFs found</span>
            <span className="cp-empty-body">Try a different search.</span>
          </div>
        )}

        {state === 'ready' && results.length > 0 && (
          <div ref={containerRef} className="cp-grid cp-grid-gif">
            {results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="cp-gif"
                data-cp-index={index}
                data-active={index === active}
                title={item.title}
                onClick={() => onUse({ source: 'gif', url: item.url, label: item.title })}
              >
                <img src={item.previewUrl} alt={item.title} loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cp-footer">
        <span>Powered by Tenor</span>
        <span>URL copied</span>
      </div>
    </>
  );
}
