import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { DockRect, DockSettings } from '../shared/dock.js';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';
import { applyStrut, clearStrut } from './dockStrut.js';

const DOCK_PATH = path.join(RENDERER_DIR, 'dock.html');

export interface DockGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the dock sits when revealed (used as the anchor for previews). */
  revealed: DockRect;
}

/** Fallback content size used until the renderer reports its measured row. */
function estimateContent(settings: DockSettings): { width: number; height: number } {
  const thickness = Math.round(settings.iconSize * settings.zoom) + 34;
  return { width: 320, height: thickness };
}

/**
 * Computes the dock bounds from the renderer's measured content size.
 *
 * The window is sized to its content rather than the full screen edge: on X11 a
 * transparent Electron window still captures pointer events across its whole
 * rectangle, so a full-width dock would swallow clicks at the bottom of the screen.
 */
export function dockGeometry(
  settings: DockSettings,
  content = estimateContent(settings),
  area = screen.getPrimaryDisplay().workArea,
): DockGeometry {
  const width = Math.max(48, Math.round(content.width));
  const height = Math.max(48, Math.round(content.height));

  if (settings.position === 'left' || settings.position === 'right') {
    const x = settings.position === 'left' ? area.x : area.x + area.width - width;
    const y = Math.round(area.y + (area.height - height) / 2);
    return { x, y, width, height, revealed: { x, y, width, height } };
  }

  const x = Math.round(area.x + (area.width - width) / 2);
  const y = area.y + area.height - height;
  return { x, y, width, height, revealed: { x, y, width, height } };
}

export class DockWindow {
  private win: BrowserWindow | null = null;
  private settings: DockSettings;
  private content: { width: number; height: number };
  private hiddenOffset = 0;
  private strutOk = true;
  /** Thickness the dock itself reserved on `reservedEdge`, in px. */
  private reserved = 0;
  private reservedEdge: DockSettings['position'] | null = null;
  private strutInstalled = false;

  constructor(settings: DockSettings) {
    this.settings = settings;
    this.content = estimateContent(settings);
  }

  get window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null;
  }

  get strutSupported(): boolean {
    return this.strutOk;
  }

  create(): BrowserWindow {
    const existing = this.window;
    if (existing) return existing;

    const geometry = this.geometry();

    const win = new BrowserWindow({
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
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
      ...(process.platform === 'linux' ? { type: 'dock' as const } : {}),
    });

    win.setTitle('Desktop Dock');
    win.on('page-title-updated', (event) => event.preventDefault());

    // The dock must never take focus from the app the user is switching to.
    win.on('focus', () => {
      if (!win.isDestroyed()) win.blur();
    });

    win.once('ready-to-show', () => {
      win.showInactive();
      void this.syncStrut();
    });

    // Panels appearing/disappearing (or Plank being stopped) change the work area;
    // the dock has to re-anchor instead of floating where it used to be.
    const reflow = () => {
      if (this.isHidden) this.hide();
      else this.applyBounds();
      void this.syncStrut();
    };
    screen.on('display-metrics-changed', reflow);

    win.on('closed', () => {
      screen.removeListener('display-metrics-changed', reflow);
      this.win = null;
    });

    if (DEV_SERVER_URL) void win.loadURL(`${DEV_SERVER_URL}/dock.html`);
    else void win.loadFile(DOCK_PATH);

    this.win = win;
    return win;
  }

  /** The renderer reports the row it needs; we resize and re-strut to match. */
  resizeToContent(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width <= 0 || height <= 0) return;

    const next = { width: Math.round(width), height: Math.round(height) };
    if (Math.abs(next.width - this.content.width) < 2 && Math.abs(next.height - this.content.height) < 2) {
      return;
    }

    this.content = next;
    this.applyBounds();
    void this.syncStrut();
  }

  applySettings(settings: DockSettings): void {
    // A move to a different edge invalidates the reservation recorded for the old
    // edge; syncStrut records the new one.
    if (settings.position !== this.settings.position) {
      this.reserved = 0;
      this.reservedEdge = null;
      this.strutInstalled = false;
    }

    this.settings = settings;
    // The row's measured size depends on iconSize/zoom, so let the renderer re-report.
    if (this.isHidden) this.hide();
    else this.applyBounds();
    void this.syncStrut();
  }

  private applyBounds(): void {
    const win = this.window;
    if (!win) return;
    this.hiddenOffset = 0;
    const geometry = this.geometry();
    win.setBounds({ x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height });
  }

  /**
   * The display work area *without* this dock's own reservation.
   *
   * `workArea` already excludes struts, including the one this dock sets; measuring
   * against it directly would make the dock move out of its own way on every resize.
   * Adding the reserved strip back keeps the geometry stable while still honoring
   * external panels.
   */
  private baseArea(): Electron.Rectangle {
    const area = { ...screen.getPrimaryDisplay().workArea };
    if (!this.strutInstalled || !this.reservedEdge) return area;

    if (this.reservedEdge === 'bottom') {
      area.height += this.reserved;
    } else if (this.reservedEdge === 'left') {
      area.x -= this.reserved;
      area.width += this.reserved;
    } else {
      area.width += this.reserved;
    }
    return area;
  }

  private geometry(content = this.content): DockGeometry {
    return dockGeometry(this.settings, content, this.baseArea());
  }

  /** Writes or clears `_NET_WM_STRUT_PARTIAL` for the current edge. */
  async syncStrut(): Promise<void> {
    const win = this.window;
    if (!win || process.platform !== 'linux') return;

    const id = xidOf(win);
    if (!id) return;

    if (this.settings.autoHide) {
      this.reserved = 0;
      this.reservedEdge = null;
      this.strutInstalled = false;
      await clearStrut(id);
      return;
    }

    const geometry = this.geometry();
    const area = this.baseArea();

    const spec = {
      id,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      leftStart: 0,
      leftEnd: 0,
      rightStart: 0,
      rightEnd: 0,
      topStart: 0,
      topEnd: 0,
      bottomStart: 0,
      bottomEnd: 0,
    };

    // Only the span the dock actually occupies is reserved, so the rest of the
    // edge keeps its full height for other windows.
    if (this.settings.position === 'bottom') {
      spec.bottom = area.y + area.height - geometry.y;
      spec.bottomStart = geometry.x;
      spec.bottomEnd = geometry.x + geometry.width;
    } else if (this.settings.position === 'left') {
      spec.left = geometry.x + geometry.width - area.x;
      spec.leftStart = geometry.y;
      spec.leftEnd = geometry.y + geometry.height;
    } else {
      spec.right = area.x + area.width - geometry.x;
      spec.rightStart = geometry.y;
      spec.rightEnd = geometry.y + geometry.height;
    }

    // Record the reservation before awaiting the write: the work area changes as
    // soon as the property lands, and the reflow that follows must already know to
    // discount it.
    const thickness =
      this.settings.position === 'bottom' ? geometry.height : geometry.width;
    this.reserved = thickness;
    this.reservedEdge = this.settings.position;
    this.strutInstalled = true;

    this.strutOk = await applyStrut(spec);
    if (!this.strutOk) {
      this.reserved = 0;
      this.reservedEdge = null;
      this.strutInstalled = false;
      return;
    }

    // The work area now reflects the new strut; recompute against the corrected base.
    this.applyBounds();
  }

  revealedRect(): DockRect {
    return this.geometry().revealed;
  }

  reveal(): void {
    const win = this.window;
    if (!win) return;
    this.applyBounds();
    win.showInactive();
    void this.syncStrut();
  }

  /** Slides the dock off the edge, leaving a thin strip the pointer can reach. */
  hide(): void {
    const win = this.window;
    if (!win) return;

    const geometry = this.geometry();
    const strip = 3;
    this.hiddenOffset = geometry.height - strip;

    if (this.settings.position === 'bottom') {
      win.setBounds({ x: geometry.x, y: geometry.y + this.hiddenOffset, width: geometry.width, height: geometry.height });
    } else if (this.settings.position === 'left') {
      win.setBounds({ x: geometry.x - this.hiddenOffset, y: geometry.y, width: geometry.width, height: geometry.height });
    } else {
      win.setBounds({ x: geometry.x + this.hiddenOffset, y: geometry.y, width: geometry.width, height: geometry.height });
    }

    void clearStrut(xidOf(win));
  }

  get isHidden(): boolean {
    return this.hiddenOffset > 0;
  }

  /** Screen rect the pointer must reach to reveal an auto-hidden dock. */
  triggerRect(): DockRect {
    const area = this.baseArea();
    const reach = 4;
    const strip = 3;

    if (this.settings.position === 'bottom') {
      return { x: area.x, y: area.y + area.height - strip - reach, width: area.width, height: strip + reach };
    }
    if (this.settings.position === 'left') {
      return { x: area.x, y: area.y, width: strip + reach, height: area.height };
    }
    return { x: area.x + area.width - strip - reach, y: area.y, width: strip + reach, height: area.height };
  }

  bounds(): DockRect | null {
    const win = this.window;
    if (!win) return null;
    const { x, y, width, height } = win.getBounds();
    return { x, y, width, height };
  }

  send(channel: string, payload?: unknown): void {
    const win = this.window;
    if (!win) return;
    win.webContents.send(channel, payload);
  }

  destroy(): void {
    const win = this.window;
    if (!win) return;
    const id = xidOf(win);
    if (id) void clearStrut(id);
    win.destroy();
    this.win = null;
  }
}

/** Native X11 window id, needed for the strut property. */
function xidOf(win: BrowserWindow): number {
  try {
    // `getNativeWindowHandle` returns a little-endian pointer-sized buffer.
    const handle = win.getNativeWindowHandle();
    return handle.length >= 8 ? Number(handle.readBigUInt64LE(0)) : handle.readUInt32LE(0);
  } catch {
    return 0;
  }
}
