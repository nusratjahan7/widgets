import { nativeImage } from 'electron';
import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import { isRecord } from '../../shared/config/values.js';
import { IPC } from '../../shared/ipc.js';
import {
  PANEL_LIMITS,
  type ClipboardHistoryItem,
  type ClipboardImageItem,
  type PanelRecentItem,
} from '../../shared/clipboard-panel/types.js';
import { sendToPanel } from './bridge.js';
import { hashBytes, hashText } from './hash.js';
import { deleteMedia, mediaExists, mediaPath, pruneOrphans, writeMedia } from './media.js';

export type IncomingClipboard =
  | { kind: 'text'; text: string }
  | { kind: 'image'; png: Buffer };

interface PanelStore {
  history: ClipboardHistoryItem[];
  recents: PanelRecentItem[];
}

export const panelStore = new Store<PanelStore>({
  name: 'clipboard-panel',
  defaults: { history: [], recents: [] },
  clearInvalidConfig: true,
});

const ID_PATTERN = /^[a-z0-9-]{8,64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function sanitizeText(raw: Record<string, unknown>): ClipboardHistoryItem | null {
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  if (typeof raw.text !== 'string') return null;

  const text = raw.text.slice(0, PANEL_LIMITS.text);
  if (!text.trim()) return null;

  return {
    id: raw.id,
    kind: 'text',
    text,
    hash: typeof raw.hash === 'string' && HASH_PATTERN.test(raw.hash) ? raw.hash : hashText(text),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    pinned: raw.pinned === true,
  };
}

function sanitizeImage(raw: Record<string, unknown>): ClipboardHistoryItem | null {
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  if (!mediaExists(raw.id)) return null;

  const width = typeof raw.width === 'number' ? Math.round(raw.width) : 0;
  const height = typeof raw.height === 'number' ? Math.round(raw.height) : 0;

  return {
    id: raw.id,
    kind: 'image',
    file: `${raw.id}.png`,
    width: Math.max(0, width),
    height: Math.max(0, height),
    bytes: typeof raw.bytes === 'number' ? raw.bytes : 0,
    hash: typeof raw.hash === 'string' && HASH_PATTERN.test(raw.hash) ? raw.hash : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    pinned: raw.pinned === true,
  };
}

function sanitize(raw: unknown): ClipboardHistoryItem | null {
  if (!isRecord(raw)) return null;
  return raw.kind === 'image' ? sanitizeImage(raw) : sanitizeText(raw);
}

export function list(): ClipboardHistoryItem[] {
  const stored = panelStore.get('history');
  if (!Array.isArray(stored)) return [];
  return stored.map(sanitize).filter((item): item is ClipboardHistoryItem => item !== null);
}

function persist(items: ClipboardHistoryItem[]): ClipboardHistoryItem[] {
  panelStore.set('history', items);
  const next = list();
  sendToPanel(IPC.panelHistory, next);
  return next;
}

function removeMedia(item: ClipboardHistoryItem): void {
  if (item.kind === 'image') deleteMedia(item.id);
}

/** Keeps the 50 newest items, dropping the oldest unpinned first. */
function trim(items: ClipboardHistoryItem[]): ClipboardHistoryItem[] {
  while (items.length > PANEL_LIMITS.history) {
    let index = -1;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (!items[i].pinned) {
        index = i;
        break;
      }
    }
    if (index === -1) index = items.length - 1;
    const [removed] = items.splice(index, 1);
    if (removed) removeMedia(removed);
  }
  return items;
}

function moveToTop(
  items: ClipboardHistoryItem[],
  index: number,
  pinned: boolean,
): ClipboardHistoryItem[] {
  const [item] = items.splice(index, 1);
  if (!item) return items;
  const next: ClipboardHistoryItem = { ...item, createdAt: Date.now(), pinned: item.pinned || pinned };
  items.unshift(next);
  return items;
}

export function add(content: IncomingClipboard): void {
  const current = list();

  if (content.kind === 'text') {
    const text = content.text.slice(0, PANEL_LIMITS.text);
    if (!text.trim()) return;

    const hash = hashText(text);
    const existing = current.findIndex((item) => item.hash === hash);
    if (existing >= 0) {
      persist(moveToTop(current, existing, false));
      return;
    }

    const next: ClipboardHistoryItem[] = [
      {
        id: randomUUID(),
        kind: 'text',
        text,
        hash,
        createdAt: Date.now(),
        pinned: false,
      },
      ...current,
    ];
    persist(trim(next));
    return;
  }

  if (content.png.length === 0 || content.png.length > PANEL_LIMITS.imageBytes) return;

  const hash = hashBytes(content.png);
  const existing = current.findIndex((item) => item.hash === hash);
  if (existing >= 0) {
    persist(moveToTop(current, existing, false));
    return;
  }

  const image = nativeImage.createFromBuffer(content.png);
  if (image.isEmpty()) return;

  const id = randomUUID();
  if (!writeMedia(id, content.png)) return;

  const { width, height } = image.getSize();
  const item: ClipboardImageItem = {
    id,
    kind: 'image',
    file: `${id}.png`,
    width,
    height,
    bytes: content.png.length,
    hash,
    createdAt: Date.now(),
    pinned: false,
  };

  persist(trim([item, ...current]));
}

export function remove(id: unknown): ClipboardHistoryItem[] {
  if (typeof id !== 'string') return list();
  const current = list();
  const target = current.find((item) => item.id === id);
  if (!target) return current;
  removeMedia(target);
  return persist(current.filter((item) => item.id !== id));
}

export function clear(): ClipboardHistoryItem[] {
  for (const item of list()) removeMedia(item);
  return persist([]);
}

export function setPinned(id: unknown, pinned: unknown): ClipboardHistoryItem[] {
  if (typeof id !== 'string' || typeof pinned !== 'boolean') return list();
  return persist(list().map((item) => (item.id === id ? { ...item, pinned } : item)));
}

export function mediaPathFor(item: ClipboardHistoryItem): string | null {
  return item.kind === 'image' ? mediaPath(item.id) : null;
}

/** Drops entries whose image file disappeared and removes leftover PNGs. */
export function reconcileMedia(): void {
  const items = list();
  const referenced = new Set(items.filter((item) => item.kind === 'image').map((item) => item.id));
  pruneOrphans(referenced);
  const stored = panelStore.get('history');
  if (Array.isArray(stored) && stored.length !== items.length) panelStore.set('history', items);
}
