import { BrowserWindow, ClipboardItem, clipboard, Notification, screen } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { IPC } from '../../shared/ipc.js';
import {
  PANEL_LIMITS,
  type ClipboardHistoryItem,
  type ClipboardPanelSettings,
  type ClipboardPanelStatus,
  type PanelRecentItem,
  type PanelUseRequest,
} from '../../shared/clipboard-panel/types.js';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from '../paths.js';
import { activeWindow, focusWindow, sessionIsX11 } from '../x11.js';
import { setPanelWindow, sendToPanel } from './bridge.js';
import * as history from './history.js';
import * as recents from './recents.js';
import { hashBytes, hashText } from './hash.js';
import { ClipboardWatcher } from './watcher.js';
import { detectPasteTool, pasteInto, pasteTool } from './paster.js';

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 460;
const EDGE = 8;
const CURSOR_GAP = 12;
const BLUR_GRACE_MS = 150;
const FOCUS_RETURN_MS = 140;
const PASTE_DELAY_MS = 100;

/** Linux ignores skipTaskbar; an EWMH toolbar window is what stays out of the dock. */
const PANEL_WINDOW_TYPE = process.platform === 'linux' ? 'toolbar' : 'utility';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Resolved =
  | { kind: 'text'; text: string; recent?: PanelRecentItem }
  | { kind: 'image'; png: Buffer; hashes: string[] };

function sessionKind(): ClipboardPanelStatus['session'] {
  if (process.platform !== 'linux') return 'other';
  return sessionIsX11() ? 'x11' : 'wayland';
}

export class ClipboardPanelController {
  private win: BrowserWindow | null = null;
  private settings: ClipboardPanelSettings;
  private readonly watcher: ClipboardWatcher;
  private previousWindowId: number | null = null;
  private shownAt = 0;
  private lastHiddenAt = 0;
  private pasting = false;
  private started = false;
  private drag: { origin: { x: number; y: number }; start: { x: number; y: number } } | null = null;

  constructor(settings: ClipboardPanelSettings) {
    this.settings = settings;
    this.watcher = new ClipboardWatcher(
      (content) => history.add(content),
      (message) => console.warn('[clipboard-panel]', message),
    );
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const tool = await detectPasteTool();
    if (!tool) {
      console.warn(
        '[clipboard-panel] no paste tool found — install xdotool (X11) or wtype/ydotool (Wayland); auto-paste will copy only',
      );
    }
    history.reconcileMedia();
    if (this.settings.historyEnabled) this.watcher.start();
  }

  applySettings(next: ClipboardPanelSettings): void {
    const wasRunning = this.watcher.running;
    this.settings = next;

    if (next.historyEnabled && !wasRunning) this.watcher.start();
    if (!next.historyEnabled && wasRunning) this.watcher.stop();

    void detectPasteTool(true);

    if (!next.enabled) this.hide();
  }

  toggle(): void {
    if (!this.settings.enabled) return;
    if (this.isVisible()) this.hide();
    else void this.show();
  }

  isVisible(): boolean {
    return Boolean(this.win && !this.win.isDestroyed() && this.win.isVisible());
  }

  async show(): Promise<void> {
    if (!this.settings.enabled) return;

    const win = this.ensureWindow();

    if (sessionIsX11()) {
      try {
        this.previousWindowId = await activeWindow();
      } catch {
        this.previousWindowId = null;
      }
    } else {
      this.previousWindowId = null;
    }

    this.position(win);
    this.shownAt = Date.now();

    // Re-assert on every show: some window managers drop the hint between shows.
    win.setSkipTaskbar(true);
    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.show();
    win.focus();

    sendToPanel(IPC.panelShown);
    sendToPanel(IPC.panelHistory, history.list());
    sendToPanel(IPC.panelRecents, recents.list());
  }

  hide(): void {
    this.lastHiddenAt = Date.now();
    this.drag = null;
    const win = this.win;
    if (win && !win.isDestroyed() && win.isVisible()) win.hide();
  }

  beginDrag(screenX: number, screenY: number): void {
    const win = this.win;
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const [x, y] = win.getPosition();
    this.drag = { origin: { x, y }, start: { x: screenX, y: screenY } };
  }

  updateDrag(screenX: number, screenY: number): void {
    if (!this.drag) return;
    const win = this.win;
    if (!win || win.isDestroyed()) return;

    const nextX = this.drag.origin.x + Math.round(screenX - this.drag.start.x);
    const nextY = this.drag.origin.y + Math.round(screenY - this.drag.start.y);
    const area = screen.getDisplayNearestPoint({
      x: nextX + Math.round(PANEL_WIDTH / 2),
      y: nextY + Math.round(PANEL_HEIGHT / 2),
    }).workArea;

    const x = Math.round(
      Math.min(Math.max(nextX, area.x), Math.max(area.x, area.x + area.width - PANEL_WIDTH)),
    );
    const y = Math.round(
      Math.min(Math.max(nextY, area.y), Math.max(area.y, area.y + area.height - PANEL_HEIGHT)),
    );

    // On Linux fractional scaling, setPosition can grow the window on every
    // call. Passing the fixed size with the move keeps it constant.
    if (process.platform === 'linux') {
      win.setBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
    } else {
      win.setPosition(x, y);
    }
  }

  endDrag(): void {
    this.drag = null;
  }

  status(): ClipboardPanelStatus {
    return {
      session: sessionKind(),
      pasteTool: pasteTool(),
      clipboardWatch: this.watcher.running,
      klipyConfigured: Boolean(this.settings.klipyApiKey),
    };
  }

  /** Copies an item, hides the panel, and pastes into the previous window when possible. */
  async useItem(raw: unknown): Promise<void> {
    const resolved = this.resolve(raw);
    if (!resolved) return;

    if (resolved.kind === 'text') {
      try {
        await clipboard.writeText(resolved.text);
      } catch (error) {
        console.warn('[clipboard-panel] could not write text to the clipboard:', error);
        this.hide();
        return;
      }
      this.watcher.markWrittenText(resolved.text);
      this.watcher.suppress(hashText(resolved.text.slice(0, PANEL_LIMITS.text)));
      if (resolved.recent) recents.record(resolved.recent);
    } else {
      try {
        const blob = new Blob([new Uint8Array(resolved.png)], { type: 'image/png' });
        await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch (error) {
        console.warn('[clipboard-panel] could not write image to the clipboard:', error);
        this.hide();
        return;
      }
      this.watcher.suppressImage();
      this.watcher.markWrittenImage(resolved.hashes[0] ?? '');
      for (const hash of resolved.hashes) this.watcher.suppress(hash);
    }

    this.hide();
    if (!this.settings.autoPaste) return;

    this.pasting = true;
    try {
      // Give the window manager time to return focus to the previous app.
      await sleep(FOCUS_RETURN_MS);

      const tool = pasteTool();
      if (!tool) {
        console.warn('[clipboard-panel] no paste tool (xdotool/wtype/ydotool); copied only');
        this.notifyCopyFallback();
        return;
      }

      if (sessionIsX11() && this.previousWindowId) {
        const restored = await focusWindow(this.previousWindowId);
        if (!restored) {
          console.warn(`[clipboard-panel] could not refocus window ${this.previousWindowId}`);
        }
        await sleep(PASTE_DELAY_MS);
      }

      if (!(await pasteInto(tool))) {
        this.notifyCopyFallback();
      }
    } finally {
      this.pasting = false;
    }
  }

  /** Visible fallback when auto-paste is unavailable: the item is already in the clipboard. */
  private notifyCopyFallback(): void {
    if (!Notification.isSupported()) return;
    new Notification({
      title: 'Copied to clipboard',
      body: 'Auto-paste is unavailable — press Ctrl+V to paste.',
      urgency: 'low',
    }).show();
  }

  stop(): void {
    this.watcher.stop();
    this.drag = null;
    const win = this.win;
    this.win = null;
    setPanelWindow(null);
    if (win && !win.isDestroyed()) win.destroy();
  }

  private resolve(raw: unknown): Resolved | null {
    if (!raw || typeof raw !== 'object') return null;
    const request = raw as Partial<PanelUseRequest>;

    if (request.source === 'emoji' || request.source === 'symbol' || request.source === 'kaomoji') {
      const value = typeof request.value === 'string' ? request.value.slice(0, 256) : '';
      if (!value) return null;
      return {
        kind: 'text',
        text: value,
        recent: {
          kind: request.source,
          value,
          label:
            typeof request.label === 'string' && request.label.trim()
              ? request.label.slice(0, 120)
              : value,
          at: Date.now(),
        },
      };
    }

    if (request.source === 'gif') {
      const url = typeof request.url === 'string' ? request.url.slice(0, 2048) : '';
      if (!/^https?:\/\//i.test(url)) return null;
      return {
        kind: 'text',
        text: url,
        recent: {
          kind: 'gif',
          value: url,
          label:
            typeof request.label === 'string' && request.label.trim()
              ? request.label.slice(0, 120)
              : 'GIF',
          at: Date.now(),
        },
      };
    }

    if (request.source === 'history') {
      const id = typeof request.id === 'string' ? request.id : '';
      const item = history.list().find((candidate) => candidate.id === id);
      if (!item) return null;
      return this.resolveHistoryItem(item);
    }

    return null;
  }

  private resolveHistoryItem(item: ClipboardHistoryItem): Resolved | null {
    if (item.kind === 'text') return { kind: 'text', text: item.text };

    const file = history.mediaPathFor(item);
    if (!file) return null;

    try {
      const png = readFileSync(file);
      if (png.length === 0) return null;
      return { kind: 'image', png, hashes: [hashBytes(png)] };
    } catch {
      return null;
    }
  }

  private position(win: BrowserWindow): void {
    const point = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(point).workArea;

    let x = point.x + CURSOR_GAP;
    let y = point.y + CURSOR_GAP;

    if (x + PANEL_WIDTH > area.x + area.width - EDGE) x = point.x - PANEL_WIDTH - CURSOR_GAP;
    if (y + PANEL_HEIGHT > area.y + area.height - EDGE) y = point.y - PANEL_HEIGHT - CURSOR_GAP;

    x = Math.min(Math.max(x, area.x + EDGE), area.x + area.width - PANEL_WIDTH - EDGE);
    y = Math.min(Math.max(y, area.y + EDGE), area.y + area.height - PANEL_HEIGHT - EDGE);

    win.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    });
  }

  private ensureWindow(): BrowserWindow {
    const existing = this.win;
    if (existing && !existing.isDestroyed()) return existing;

    const win = new BrowserWindow({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      minWidth: PANEL_WIDTH,
      maxWidth: PANEL_WIDTH,
      minHeight: PANEL_HEIGHT,
      maxHeight: PANEL_HEIGHT,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      type: PANEL_WINDOW_TYPE,
      // Focus is needed for search and keyboard navigation; it is handed back
      // to the previous window before the paste keystroke is sent.
      focusable: true,
      alwaysOnTop: true,
      acceptFirstMouse: true,
      show: false,
      webPreferences: {
        preload: PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
        spellcheck: false,
      },
    });

    win.setTitle('Clipboard Panel');
    win.on('page-title-updated', (event) => event.preventDefault());

    // skipTaskbar is a no-op on Linux; the toolbar type above is what removes
    // the dock entry. Keep the call for macOS/Windows and re-assert before show.
    win.setSkipTaskbar(true);
    win.setMinimumSize(PANEL_WIDTH, PANEL_HEIGHT);
    win.setMaximumSize(PANEL_WIDTH, PANEL_HEIGHT);

    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.on('blur', () => {
      if (this.pasting) return;
      if (Date.now() - this.shownAt < BLUR_GRACE_MS) return;
      if (Date.now() - this.lastHiddenAt < BLUR_GRACE_MS) return;
      this.hide();
    });

    win.webContents.on('did-finish-load', () => {
      if (!this.isVisible()) return;
      sendToPanel(IPC.panelShown);
      sendToPanel(IPC.panelHistory, history.list());
      sendToPanel(IPC.panelRecents, recents.list());
    });

    win.on('closed', () => {
      if (this.win === win) this.win = null;
      setPanelWindow(null);
    });

    if (DEV_SERVER_URL) {
      void win.loadURL(`${DEV_SERVER_URL}/clipboard-panel/index.html`);
    } else {
      void win.loadFile(path.join(RENDERER_DIR, 'clipboard-panel', 'index.html'));
    }

    this.win = win;
    setPanelWindow(win);
    return win;
  }
}
