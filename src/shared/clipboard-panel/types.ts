export type PanelTab = 'recent' | 'emoji' | 'gif' | 'kaomoji' | 'symbols' | 'history';

export interface ClipboardTextItem {
  id: string;
  kind: 'text';
  text: string;
  hash: string;
  createdAt: number;
  pinned: boolean;
}

export interface ClipboardImageItem {
  id: string;
  kind: 'image';
  /** File name inside `clipboard-panel-media/`, never a full path. */
  file: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  createdAt: number;
  pinned: boolean;
}

export type ClipboardHistoryItem = ClipboardTextItem | ClipboardImageItem;

export interface PanelRecentItem {
  kind: 'emoji' | 'symbol' | 'kaomoji' | 'gif';
  value: string;
  label: string;
  at: number;
}

export type PanelUseRequest =
  | { source: 'emoji' | 'symbol' | 'kaomoji'; value: string; label?: string }
  | { source: 'gif'; url: string; label?: string }
  | { source: 'history'; id: string };

export interface KlipyResult {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
}

export interface KlipySearchResult {
  ok: boolean;
  error?: 'no-key' | 'network' | 'api';
  results: KlipyResult[];
}

export interface ClipboardPanelSettings {
  enabled: boolean;
  historyEnabled: boolean;
  autoPaste: boolean;
  klipyApiKey: string;
}

export interface ClipboardPanelStatus {
  session: 'x11' | 'wayland' | 'other';
  pasteTool: 'xdotool' | 'wtype' | 'ydotool' | null;
  clipboardWatch: boolean;
  klipyConfigured: boolean;
}

export const PANEL_LIMITS = {
  history: 50,
  recents: 30,
  /** Keeps clipboard-panel.json small; longer text is truncated. */
  text: 20_000,
  imageBytes: 8 * 1024 * 1024,
  klipyQuery: 100,
  klipyKey: 200,
} as const;

export const MEDIA_SCHEME = 'clipboard-panel-media';

export function mediaUrlFor(item: ClipboardImageItem): string {
  return `${MEDIA_SCHEME}://media/${item.id}.png`;
}
