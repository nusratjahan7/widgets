import { useEffect, useState } from 'react';
import type {
  ClipboardHistoryItem,
  PanelRecentItem,
} from '../../shared/clipboard-panel/types';
import { applyTheme } from '../lib/theme';

export function usePanelData() {
  const [history, setHistory] = useState<ClipboardHistoryItem[]>([]);
  const [recents, setRecents] = useState<PanelRecentItem[]>([]);

  useEffect(() => {
    const bridge = window.widgets;

    const applyAppearance = () => {
      bridge
        .getAppearance()
        .then((appearance) => applyTheme(appearance.theme, appearance.resolvedTheme))
        .catch(() => {});
    };

    applyAppearance();
    bridge.getClipboardHistory().then(setHistory).catch(() => {});
    bridge.getPanelRecents().then(setRecents).catch(() => {});

    const offHistory = bridge.onClipboardHistory(setHistory);
    const offRecents = bridge.onPanelRecents(setRecents);
    const offShown = bridge.onClipboardPanelShown(applyAppearance);

    return () => {
      offHistory();
      offRecents();
      offShown();
    };
  }, []);

  return { history, recents };
}
