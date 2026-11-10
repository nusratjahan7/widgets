import { useCallback, useEffect, useRef, useState } from 'react';
import type { PanelTab, PanelUseRequest } from '../../shared/clipboard-panel/types';
import { EmojiTab } from './tabs/EmojiTab';
import { GifTab } from './tabs/GifTab';
import { HistoryTab } from './tabs/HistoryTab';
import { KaomojiTab } from './tabs/KaomojiTab';
import { RecentTab } from './tabs/RecentTab';
import { SymbolsTab } from './tabs/SymbolsTab';
import { PANEL_TABS, Tabs } from './Tabs';
import { usePanelData } from './usePanelData';

const TAB_ORDER = PANEL_TABS.map((item) => item.id);

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="5.6" />
      <path d="M14.7 14.7l4.1 4.1" />
    </svg>
  );
}

export function PanelApp() {
  const { history, recents } = usePanelData();
  const [tab, setTab] = useState<PanelTab>('history');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const useItem = useCallback((request: PanelUseRequest) => {
    void window.widgets.useClipboardPanelItem(request);
  }, []);

  const changeTab = useCallback((next: PanelTab) => {
    setTab(next);
    setQuery('');
  }, []);

  useEffect(() => {
    return window.widgets.onClipboardPanelShown(() => setQuery(''));
  }, []);

  useEffect(() => {
    if (tab !== 'emoji' && tab !== 'gif') return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [tab]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (query) setQuery('');
        else window.widgets.hideClipboardPanel();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const index = TAB_ORDER.indexOf(tab);
        const delta = event.shiftKey ? -1 : 1;
        changeTab(TAB_ORDER[(index + delta + TAB_ORDER.length) % TAB_ORDER.length]);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, query, changeTab]);

  return (
    <div className="cp-root">
      <div className="cp-card">
        <Tabs tab={tab} onChange={changeTab} />

        <div className="cp-body">
          {(tab === 'emoji' || tab === 'gif') && (
            <div className="cp-search">
              <SearchIcon />
              <input
                ref={searchRef}
                value={query}
                spellCheck={false}
                aria-label={tab === 'emoji' ? 'Search emoji' : 'Search KLIPY'}
                placeholder={tab === 'emoji' ? 'Search emoji' : 'Search KLIPY'}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="cp-search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )}

          {tab === 'recent' && <RecentTab recents={recents} onUse={useItem} />}
          {tab === 'emoji' && <EmojiTab query={query} onUse={useItem} />}
          {tab === 'gif' && <GifTab query={query} onUse={useItem} />}
          {tab === 'kaomoji' && <KaomojiTab onUse={useItem} />}
          {tab === 'symbols' && <SymbolsTab onUse={useItem} />}
          {tab === 'history' && (
            <HistoryTab
              history={history}
              onUse={useItem}
              onDelete={(id) => {
                void window.widgets.deleteClipboardItem(id);
              }}
              onPin={(id, pinned) => {
                void window.widgets.pinClipboardItem(id, pinned);
              }}
              onClear={() => {
                void window.widgets.clearClipboardHistory();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
