import { BrowserWindow, desktopCapturer, screen, type NativeImage } from 'electron';
import path from 'node:path';
import { thumbHeightFor, type DockPreviewPayload, type DockRect, type DockSettings } from '../shared/dock.js';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';

const PREVIEW_PATH = path.join(RENDERER_DIR, 'preview.html');

/** Gap between the preview row and the dock edge. */
const GAP = 10;
/** Card padding + title row below the thumbnail. */
const CARD_CHROME = 62;
const CARD_GAP = 12;
const ROW_PADDING = 24;
const SCREEN_MARGIN = 8;
const REFRESH_MS = 1500;

export interface PreviewRequest {
  appKey: string;
  appName: string;
  appIcon: string;
  /** Icon rectangle in screen coordinates. */
  anchor: DockRect;
  windows: { id: number; title: string; minimized: boolean; focused: boolean }[];
}

function intersects(a: DockRect, b: DockRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function contains(rect: DockRect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export class DockPreview {
  private win: BrowserWindow | null = null;
  private settings: DockSettings;
  private payload: DockPreviewPayload | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private shown = false;

  constructor(settings: DockSettings) {
    this.settings = settings;
  }

  get window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null;
  }

  get isVisible(): boolean {
    const win = this.window;
    return Boolean(win && this.shown);
  }

  get activeKey(): string | null {
    return this.payload?.appKey ?? null;
  }

  /** Re-sends the current payload; called once the preview renderer is listening. */
  resend(): void {
    this.send();
  }

  applySettings(settings: DockSettings): void {
    this.settings = settings;
  }

  /** Creates (or reuses) the preview window and paints the first frame. */
  async show(request: PreviewRequest, settings: DockSettings): Promise<void> {
    this.settings = settings;

    const thumbWidth = settings.thumbScale;
    const thumbHeight = thumbHeightFor(thumbWidth);
    const count = Math.max(1, request.windows.length);

    const payload: DockPreviewPayload = {
      appKey: request.appKey,
      appName: request.appName,
      appIcon: request.appIcon,
      windows: request.windows.map((window) => ({
        id: window.id,
        title: window.title,
        minimized: window.minimized,
        focused: window.focused,
        thumbnail: null,
      })),
      showClose: settings.showClose,
      thumbWidth,
      thumbHeight,
      x11: true,
    };

    const width = Math.round(count * (thumbWidth + CARD_GAP) - CARD_GAP + ROW_PADDING);
    const height = Math.round(thumbHeight + CARD_CHROME + ROW_PADDING);

    const win = this.ensureWindow();
    this.payload = payload;
    this.position(win, request.anchor, width, height);

    win.setSize(width, height);
    this.shown = true;
    win.showInactive();

    // `showInactive` keeps focus with the app, but the window still needs to be
    // above the dock on some WMs.
    win.setAlwaysOnTop(true, 'pop-up-menu');
    this.send();

    await this.refreshThumbnails();
    this.startPolling();
  }

  /** Re-paints an open preview when only the window list changed. */
  update(request: PreviewRequest): void {
    if (!this.payload || this.payload.appKey !== request.appKey) return;
    const win = this.window;
    if (!win) return;

    const thumbWidth = this.settings.thumbScale;
    const thumbHeight = thumbHeightFor(thumbWidth);
    const count = Math.max(1, request.windows.length);

    const width = Math.round(count * (thumbWidth + CARD_GAP) - CARD_GAP + ROW_PADDING);
    const height = Math.round(thumbHeight + CARD_CHROME + ROW_PADDING);

    const current = this.payload;
    const previous = new Map(current.windows.map((window) => [window.id, window.thumbnail]));
    const windows = request.windows.map((window) => ({
      id: window.id,
      title: window.title,
      minimized: window.minimized,
      focused: window.focused,
      // Keep the last frame so the card does not flash while the list settles.
      thumbnail: previous.get(window.id) ?? null,
    }));

    // The list refresh runs every second; re-sending an identical payload would
    // restart the card's entry animation and cause a visible flicker.
    const unchanged =
      current.thumbWidth === thumbWidth &&
      current.thumbHeight === thumbHeight &&
      current.showClose === this.settings.showClose &&
      windows.length === current.windows.length &&
      windows.every((window, index) => {
        const existing = current.windows[index];
        return (
          existing.id === window.id &&
          existing.title === window.title &&
          existing.minimized === window.minimized &&
          existing.focused === window.focused
        );
      });

    this.position(win, request.anchor, width, height);
    if (unchanged) return;

    this.payload = {
      ...current,
      showClose: this.settings.showClose,
      thumbWidth,
      thumbHeight,
      windows,
    };
    win.setSize(width, height);
    this.send();
  }

  /** Replaces the payload with a Wayland/no-X11 notice. */
  showUnavailable(reason: string, anchor: DockRect): void {
    const win = this.ensureWindow();
    const width = 320;
    const height = 150;

    this.payload = {
      appKey: '',
      appName: reason,
      appIcon: '',
      windows: [],
      showClose: false,
      thumbWidth: this.settings.thumbScale,
      thumbHeight: thumbHeightFor(this.settings.thumbScale),
      x11: false,
    };

    this.position(win, anchor, width, height);
    win.setSize(width, height);
    this.shown = true;
    win.showInactive();
    this.send();
  }

  hide(): void {
    this.stopPolling();
    const win = this.window;
    this.shown = false;
    this.payload = null;
    if (!win) return;
    win.hide();
    win.webContents.send('dock:preview-closed');
  }

  /** Screen bounds of the card row, used for the icon→card hover handoff. */
  bounds(): DockRect | null {
    const win = this.window;
    if (!win || !this.shown) return null;
    const { x, y, width, height } = win.getBounds();
    return { x, y, width, height };
  }

  containsPoint(point: { x: number; y: number }): boolean {
    const bounds = this.bounds();
    return bounds ? contains(bounds, point) : false;
  }

  /** True when the pointer is within the card row or the gap leading to it. */
  isNear(point: { x: number; y: number }, slack = 6): boolean {
    const bounds = this.bounds();
    if (!bounds) return false;
    return contains(
      { x: bounds.x - slack, y: bounds.y - slack, width: bounds.width + slack * 2, height: bounds.height + slack * 2 },
      point,
    );
  }

  /** Sends the current payload, deferring to `did-finish-load` while the page loads. */
  private send(): void {
    const win = this.window;
    if (!win || !this.payload) return;
    if (win.webContents.isLoadingMainFrame()) return;
    win.webContents.send('dock:preview', this.payload);
  }

  /** Stops the capture poll while the preview is hidden. */
  private stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private startPolling(): void {
    this.stopPolling();
    this.timer = setInterval(() => {
      void this.refreshThumbnails();
    }, REFRESH_MS);
  }

  private ensureWindow(): BrowserWindow {
    const existing = this.window;
    if (existing) return existing;

    const win = new BrowserWindow({
      width: 300,
      height: 200,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      /** Critical: a focusable preview would steal `_NET_ACTIVE_WINDOW` on hover. */
      focusable: false,
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
      ...(process.platform === 'linux' ? { type: 'utility' as const } : {}),
    });

    win.setTitle('Desktop Dock Preview');
    win.on('page-title-updated', (event) => event.preventDefault());

    // The first payload is sent before the renderer has registered its listener;
    // re-send the latest one once the page has loaded.
    win.webContents.on('did-finish-load', () => {
      if (this.shown && this.payload) this.send();
    });

    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.on('closed', () => {
      this.win = null;
    });

    if (DEV_SERVER_URL) void win.loadURL(`${DEV_SERVER_URL}/preview.html`);
    else void win.loadFile(PREVIEW_PATH);

    this.win = win;
    return win;
  }

  /** Centers the row over the anchor, then clamps it into the work area. */
  private position(win: BrowserWindow, anchor: DockRect, width: number, height: number): void {
    const display = screen.getDisplayMatching(anchor);
    const area = display.workArea;
    const position = this.settings.position;

    let x: number;
    let y: number;

    if (position === 'bottom') {
      x = anchor.x + anchor.width / 2 - width / 2;
      y = anchor.y - height - GAP;
      // Not enough room above: flip below the dock instead of covering it.
      if (y < area.y + SCREEN_MARGIN) y = anchor.y + anchor.height + GAP;
    } else if (position === 'left') {
      x = anchor.x + anchor.width + GAP;
      y = anchor.y + anchor.height / 2 - height / 2;
    } else {
      x = anchor.x - width - GAP;
      y = anchor.y + anchor.height / 2 - height / 2;
    }

    x = Math.min(Math.max(x, area.x + SCREEN_MARGIN), area.x + area.width - width - SCREEN_MARGIN);
    y = Math.min(Math.max(y, area.y + SCREEN_MARGIN), area.y + area.height - height - SCREEN_MARGIN);

    win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  }

  /**
   * Captures each visible window.
   *
   * `desktopCapturer` ids look like `window:<decimal xid>`; window ids we track are
   * decimal too, but the comparison is numeric so formatting cannot break the join.
   */
  private async refreshThumbnails(): Promise<void> {
    const payload = this.payload;
    const win = this.window;
    if (!payload || !win || !this.shown || this.refreshing) return;

    this.refreshing = true;
    try {
      const thumbWidth = Math.round(this.settings.thumbScale * 2);
      const thumbHeight = Math.round(thumbHeightFor(this.settings.thumbScale) * 2);

      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: thumbWidth, height: thumbHeight },
        fetchWindowIcons: false,
      });

      if (!this.payload || !this.shown) return;

      const byId = new Map<number, NativeImage>();
      const byTitle = new Map<string, NativeImage>();
      for (const source of sources) {
        const numeric = Number.parseInt(source.id.replace(/^window:/, ''), 10);
        if (Number.isFinite(numeric)) byId.set(numeric, source.thumbnail);
        if (source.name) byTitle.set(source.name, source.thumbnail);
      }

      let changed = false;
      const windows = this.payload.windows.map((window) => {
        const image = byId.get(window.id) ?? byTitle.get(window.title);
        const usable = image && !image.isEmpty() ? image.toDataURL() : null;
        if (usable === window.thumbnail) return window;
        changed = true;
        return { ...window, thumbnail: usable };
      });

      if (!changed) return;
      this.payload = { ...this.payload, windows };
      this.send();
    } catch (error) {
      console.warn('[dock] thumbnail capture failed:', error);
    } finally {
      this.refreshing = false;
    }
  }

  destroy(): void {
    this.stopPolling();
    const win = this.window;
    this.shown = false;
    this.payload = null;
    if (win) win.destroy();
    this.win = null;
  }
}

export { intersects, contains };
