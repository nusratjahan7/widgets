import { isRecord } from '../../shared/config/values.js';
import { IPC } from '../../shared/ipc.js';
import { PANEL_LIMITS, type PanelRecentItem } from '../../shared/clipboard-panel/types.js';
import { sendToPanel } from './bridge.js';
import { panelStore } from './history.js';

const KINDS: PanelRecentItem['kind'][] = ['emoji', 'symbol', 'kaomoji', 'gif'];

function sanitize(raw: unknown): PanelRecentItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.kind !== 'string' || !(KINDS as string[]).includes(raw.kind)) return null;

  const limit = raw.kind === 'gif' ? 2048 : 256;
  const value = typeof raw.value === 'string' ? raw.value.slice(0, limit) : '';
  if (!value) return null;

  return {
    kind: raw.kind as PanelRecentItem['kind'],
    value,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.slice(0, 120) : value,
    at: typeof raw.at === 'number' ? raw.at : Date.now(),
  };
}

export function list(): PanelRecentItem[] {
  const stored = panelStore.get('recents');
  if (!Array.isArray(stored)) return [];
  return stored.map(sanitize).filter((item): item is PanelRecentItem => item !== null);
}

export function record(item: PanelRecentItem): PanelRecentItem[] {
  const next = [
    item,
    ...list().filter((existing) => !(existing.kind === item.kind && existing.value === item.value)),
  ].slice(0, PANEL_LIMITS.recents);

  panelStore.set('recents', next);
  sendToPanel(IPC.panelRecents, next);
  return next;
}
