import { Menu, nativeImage, screen } from 'electron';
import { readFileSync } from 'node:fs';
import { store } from './settings.js';
import {
  type DockApp,
  type DockPinnedApp,
  type DockRect,
  type DockSettings,
  type DockSnapshot,
  type DockStatus,
  type DockWindow as DockWindowInfo,
} from '../shared/dock.js';
import * as x11 from './x11.js';
import {
  desktopIdForWmClass,
  findEntry,
  launchDesktopId,
  launchNewWindow,
  pinnedFromDesktopId,
  readPlankLaunchers,
  resolveIconPath,
} from './desktopEntry.js';
import { DockWindow } from './dockWindow.js';
import { DockPreview } from './dockPreview.js';
import { strutAvailable } from './dockStrut.js';

const POLL_MS = 1000;
/** Cursor sampling while a preview is live; drives the icon↔card handoff. */
const CURSOR_MS = 120;
const HIDE_GRACE_MS = 200;
const BOUNCE_MS = 2400;

type HoverPhase = 'idle' | 'armed' | 'shown' | 'hold';

interface HoverState {
  phase: HoverPhase;
  appKey: string | null;
  anchor: DockRect | null;
  armTimer: ReturnType<typeof setTimeout> | null;
  hideTimer: ReturnType<typeof setTimeout> | null;
}

const ICON_CACHE = new Map<string, string>();
const ICON_CACHE_LIMIT = 160;

export class DockController {
  private settings: DockSettings;
  private dock: DockWindow;
  private preview: DockPreview;
  private snapshot: DockSnapshot;
  private ownPid = process.pid;
  private revision = 0;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cursorTimer: ReturnType<typeof setInterval> | null = null;
  private bounceUntil = new Map<string, number>();
  /** Window id → is a dock/desktop window. Cache: the type never changes for an id. */
  private ignoredWindows = new Map<number, boolean>();
  private hover: HoverState = {
    phase: 'idle',
    appKey: null,
    anchor: null,
    armTimer: null,
    hideTimer: null,
  };

  constructor(settings: DockSettings) {
    this.settings = settings;
    this.dock = new DockWindow(settings);
    this.preview = new DockPreview(settings);
    this.snapshot = {
      apps: [],
      focusedKey: null,
      x11: x11.sessionIsX11(),
      revision: 0,
    };
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    if (!this.settings.enabled) return;
    if (!this.settings.pinnedSeeded) this.seedPinned();

    this.dock.create();
    this.dock.applySettings(this.settings);
    void this.refresh();

    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.refresh();
    }, POLL_MS);

    // Auto-hide needs the pointer sampled continuously, not only while a preview is open.
    if (this.settings.autoHide) this.startCursorWatch();
  }

  stop(): void {
    this.stopPolling();
    this.stopCursorWatch();
    this.clearHoverTimers();
    this.hover.phase = 'idle';
    this.hover.appKey = null;
    this.preview.hide();
    this.dock.destroy();
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  status(): DockStatus {
    const session = (process.env.XDG_SESSION_TYPE ?? '').toLowerCase() || (process.env.DISPLAY ? 'x11' : 'unknown');
    return {
      x11: x11.sessionIsX11(),
      strut: strutAvailable() && this.dock.strutSupported,
      session,
    };
  }

  applySettings(next: DockSettings): void {
    const wasEnabled = this.settings.enabled;
    const wasAutoHide = this.settings.autoHide;
    this.settings = next;
    this.preview.applySettings(next);
    this.dock.applySettings(next);

    if (next.autoHide) {
      this.startCursorWatch();
    } else {
      if (wasAutoHide && this.dock.isHidden) this.dock.reveal();
      this.maybeStopCursorWatch();
    }

    if (wasEnabled && !next.enabled) {
      this.stop();
    } else if (!wasEnabled && next.enabled) {
      this.start();
    } else if (next.enabled) {
      // Icon size / zoom change the row's measured size, so ask the renderer to
      // re-report after it re-renders with the new values.
      this.broadcast();
      void this.refresh();
    }
  }

  reveal(): void {
    this.dock.reveal();
  }

  /** Renderer-measured row size; the window is sized to its content. */
  resizeToContent(width: number, height: number): void {
    this.dock.resizeToContent(width, height);
  }

  /** Forces a list refresh after an action that changes the window stack. */
  async refresh(): Promise<void> {
    if (!this.settings.enabled) return;

    const x11Session = x11.sessionIsX11();
    if (!x11Session) {
      this.snapshot = {
        apps: this.buildPinnedOnly(),
        focusedKey: null,
        x11: false,
        revision: ++this.revision,
      };
      this.broadcast();
      return;
    }

    const [listed, active] = await Promise.all([x11.listWindows(), x11.activeWindow()]);

    // Our own windows (dock, preview, widgets, settings) must never appear as apps.
    const visible = await this.filterNonApps(listed.filter((window) => window.pid !== this.ownPid));

    const ids = visible.map((window) => window.id);
    const minimized = ids.length ? await x11.minimizedStates(ids) : new Map<number, boolean>();

    const grouped = new Map<string, { key: string; name: string; windows: DockApp['windows'] }>();

    for (const window of visible) {
      const groupKey = (window.wmClass || window.title || 'window').toLowerCase();
      const bucket = grouped.get(groupKey) ?? { key: groupKey, name: '', windows: [] };

      bucket.windows.push({
        ...window,
        minimized: minimized.get(window.id) ?? false,
        focused: window.id === active,
      });

      grouped.set(groupKey, bucket);
    }

    for (const bucket of grouped.values()) {
      bucket.name = windowDisplayName(bucket.windows[0].wmClass);
    }

    // Pinned apps come first and keep their order; running-only apps follow.
    const apps: DockApp[] = [];
    const used = new Set<string>();

    for (const pinned of this.settings.pinned) {
      const bucket = this.matchPinned(pinned, grouped);
      const key = pinned.key;
      used.add(bucket?.key ?? key);
      apps.push({
        key,
        name: pinned.name,
        icon: this.iconFor(pinned.icon),
        pinned: true,
        launching: this.isBouncing(key),
        windows: bucket?.windows ?? [],
      });
    }

    for (const bucket of grouped.values()) {
      if (used.has(bucket.key)) continue;
      const desktopId = desktopIdForWmClass(bucket.windows[0].wmClass);
      const key = desktopId ?? bucket.key;
      if (apps.some((entry) => entry.key === key)) {
        // A pinned app already represents this WM_CLASS under its desktop id.
        const existing = apps.find((entry) => entry.key === key);
        if (existing && existing.windows.length === 0) {
          existing.windows = bucket.windows;
          existing.launching = this.isBouncing(key);
        }
        continue;
      }

      const pinnedEntry = desktopId ? pinnedFromDesktopId(desktopId) : null;
      apps.push({
        key,
        name: pinnedEntry?.name ?? windowDisplayName(bucket.windows[0].wmClass),
        icon: this.iconFor(pinnedEntry?.icon ?? ''),
        // A desktop entry existing does not mean the user pinned it; only entries in
        // `settings.pinned` are pinned, and those were handled above.
        pinned: false,
        launching: this.isBouncing(key),
        windows: bucket.windows,
      });
    }

    const focusedWindow = apps.flatMap((entry) => entry.windows).find((window) => window.focused);
    const focusedKey = focusedWindow
      ? apps.find((entry) => entry.windows.some((window) => window.id === focusedWindow.id))?.key ?? null
      : null;

    this.snapshot = {
      apps,
      focusedKey,
      x11: true,
      revision: ++this.revision,
    };

    this.broadcast();
    this.syncLivePreview();
  }

  // ------------------------------------------------------------------- hover

  hoverStart(appKey: string, iconRect: DockRect): void {
    if (!this.settings.enabled || !this.settings.previews) return;
    if (!x11.sessionIsX11()) {
      this.clearHoverTimers();
      this.hover = {
        phase: 'shown',
        appKey: null,
        anchor: iconRect,
        armTimer: null,
        hideTimer: null,
      };
      this.preview.showUnavailable(
        'Window previews need an X11 session.',
        this.previewAnchor(iconRect),
      );
      this.startCursorWatch();
      return;
    }

    const app = this.snapshot.apps.find((entry) => entry.key === appKey);
    if (!app || app.windows.length === 0) return;

    this.clearHoverTimers();
    this.hover = {
      phase: 'armed',
      appKey,
      anchor: iconRect,
      armTimer: null,
      hideTimer: null,
    };

    if (this.preview.isVisible) {
      // Already open for another icon: swap immediately instead of waiting again.
      void this.openPreview(appKey, iconRect);
      return;
    }

    this.hover.armTimer = setTimeout(() => {
      this.hover.armTimer = null;
      if (this.hover.appKey !== appKey) return;
      void this.openPreview(appKey, iconRect);
    }, this.settings.hoverDelay);
  }

  hoverEnd(appKey: string): void {
    if (this.hover.appKey && this.hover.appKey !== appKey) return;
    // The cursor watchdog decides whether this actually hides; the renderer's
    // `mouseleave` alone can fire while the pointer is on its way to the card.
    this.scheduleHide();
  }

  previewEnter(): void {
    if (this.hover.hideTimer) {
      clearTimeout(this.hover.hideTimer);
      this.hover.hideTimer = null;
    }
    if (this.preview.isVisible) this.hover.phase = 'hold';
  }

  previewLeave(): void {
    this.scheduleHide();
  }

  /** The preview renderer has mounted and can receive its first payload. */
  previewReady(): void {
    this.preview.resend();
  }

  private async openPreview(appKey: string, anchor: DockRect): Promise<void> {
    const app = this.snapshot.apps.find((entry) => entry.key === appKey);
    if (!app) return;

    this.hover.phase = 'shown';
    this.hover.appKey = appKey;
    this.hover.anchor = anchor;

    await this.preview.show(
      {
        appKey,
        appName: app.name,
        appIcon: app.icon,
        anchor: this.previewAnchor(anchor),
        windows: app.windows.map((window) => ({
          id: window.id,
          title: window.title,
          minimized: window.minimized,
          focused: window.focused,
        })),
      },
      this.settings,
    );

    this.startCursorWatch();
  }

  /** Keeps an open preview in sync when a window opens or closes underneath it. */
  private syncLivePreview(): void {
    const key = this.preview.activeKey;
    if (!key) return;
    const app = this.snapshot.apps.find((entry) => entry.key === key);
    const anchor = this.hover.anchor;
    if (!app || !anchor) return;

    if (app.windows.length === 0) {
      this.closePreview();
      return;
    }

    this.preview.update({
      appKey: key,
      appName: app.name,
      appIcon: app.icon,
      anchor: this.previewAnchor(anchor),
      windows: app.windows.map((window) => ({
        id: window.id,
        title: window.title,
        minimized: window.minimized,
        focused: window.focused,
      })),
    });
  }

  private scheduleHide(): void {
    if (!this.preview.isVisible) {
      // Still armed but never opened: just drop the intent.
      this.hover.phase = 'idle';
      this.hover.appKey = null;
      if (this.hover.armTimer) clearTimeout(this.hover.armTimer);
      this.hover.armTimer = null;
      this.maybeStopCursorWatch();
      return;
    }

    this.hover.phase = 'shown';
    if (this.hover.hideTimer) clearTimeout(this.hover.hideTimer);
    this.hover.hideTimer = setTimeout(() => {
      this.hover.hideTimer = null;
      this.closePreview();
    }, HIDE_GRACE_MS);
  }

  private closePreview(): void {
    this.preview.hide();
    this.maybeStopCursorWatch();
    this.hover = { phase: 'idle', appKey: null, anchor: null, armTimer: null, hideTimer: null };
  }

  /**
   * Polls the real cursor while a preview is live, and continuously while auto-hide
   * is on.
   *
   * The renderer's `mouseleave` fires when the pointer crosses the gap between the
   * icon and the card, which would flicker the preview. Testing the actual pointer
   * against icon ∪ card makes that traversal safe regardless of event timing.
   */
  private startCursorWatch(): void {
    if (this.cursorTimer) return;
    this.cursorTimer = setInterval(() => this.tickCursorWatch(), CURSOR_MS);
  }

  private tickCursorWatch(): void {
    if (!this.preview.isVisible && !this.settings.autoHide) {
      this.stopCursorWatch();
      return;
    }

    const point = screen.getCursorScreenPoint();

    if (this.settings.autoHide) {
      if (this.dock.isHidden) {
        if (this.rectContains(this.dock.triggerRect(), point)) this.dock.reveal();
      } else if (!this.rectContains(this.dock.revealedRect(), point) && !this.preview.isVisible) {
        this.dock.hide();
      }
    }

    if (!this.preview.isVisible) return;

    const onIcon = this.hover.anchor ? this.rectContains(this.hover.anchor, point) : false;
    const onCard = this.preview.isNear(point);

    if (onIcon || onCard) {
      if (this.hover.hideTimer) {
        clearTimeout(this.hover.hideTimer);
        this.hover.hideTimer = null;
      }
      if (onCard) this.hover.phase = 'hold';
      return;
    }

    // Outside both: start (or keep) the grace timer.
    if (!this.hover.hideTimer) {
      this.hover.hideTimer = setTimeout(() => {
        this.hover.hideTimer = null;
        const current = screen.getCursorScreenPoint();
        const stillOnIcon = this.hover.anchor ? this.rectContains(this.hover.anchor, current) : false;
        if (stillOnIcon || this.preview.isNear(current)) return;
        this.closePreview();
      }, HIDE_GRACE_MS);
    }
  }

  private stopCursorWatch(): void {
    if (this.cursorTimer) clearInterval(this.cursorTimer);
    this.cursorTimer = null;
  }

  /** Keeps the watchdog alive for auto-hide; otherwise stops it once the card closes. */
  private maybeStopCursorWatch(): void {
    if (!this.settings.autoHide && !this.preview.isVisible) this.stopCursorWatch();
  }

  /**
   * Anchor used to place the preview card.
   *
   * The icon rect is used for horizontal centering, but the card is lifted above the
   * *dock window's* top edge: a magnified icon grows past its layout rect, so
   * anchoring on the icon would let the card overlap it. Left/right docks anchor on
   * the dock's inner edge instead.
   */
  private previewAnchor(anchor: DockRect): DockRect {
    const dock = this.dock.bounds();
    if (!dock) return anchor;

    if (this.settings.position === 'bottom') {
      return { ...anchor, y: Math.min(anchor.y, dock.y) };
    }
    if (this.settings.position === 'left') {
      return { ...anchor, x: dock.x + dock.width, width: 0 };
    }
    return { ...anchor, x: dock.x, width: 0 };
  }

  private rectContains(rect: DockRect, point: { x: number; y: number }): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  private clearHoverTimers(): void {
    if (this.hover.armTimer) clearTimeout(this.hover.armTimer);
    if (this.hover.hideTimer) clearTimeout(this.hover.hideTimer);
    this.hover.armTimer = null;
    this.hover.hideTimer = null;
  }

  // ----------------------------------------------------------------- actions

  async focusWindow(id: number): Promise<void> {
    this.closePreview();
    await x11.focusWindow(id);
    setTimeout(() => void this.refresh(), 120);
  }

  async closeWindow(id: number): Promise<void> {
    await x11.closeWindow(id);
    setTimeout(() => void this.refresh(), 180);
  }

  async closeAll(appKey: string): Promise<void> {
    const app = this.snapshot.apps.find((entry) => entry.key === appKey);
    if (!app) return;
    this.closePreview();
    await Promise.all(app.windows.map((window) => x11.closeWindow(window.id)));
    setTimeout(() => void this.refresh(), 220);
  }

  async launch(appKey: string, newWindow = false): Promise<void> {
    const pinned = this.settings.pinned.find((entry) => entry.key === appKey);
    const desktopId = pinned?.key ?? appKey;

    this.markBouncing(appKey);
    this.broadcast();

    const ok = newWindow ? await launchNewWindow(desktopId) : await launchDesktopId(desktopId);
    if (!ok) {
      this.clearBounce(appKey);
      this.broadcast();
      return;
    }

    setTimeout(() => void this.refresh(), 900);
    setTimeout(() => {
      this.clearBounce(appKey);
      this.broadcast();
    }, BOUNCE_MS);
  }

  setPinned(appKey: string, pinned: boolean): void {
    const current = this.settings.pinned;
    const exists = current.some((entry) => entry.key === appKey);

    if (pinned && !exists) {
      const entry = pinnedFromDesktopId(appKey) ?? this.pinnedFromRunning(appKey);
      if (entry) this.settings.pinned = [...current, entry];
    } else if (!pinned && exists) {
      this.settings.pinned = current.filter((entry) => entry.key !== appKey);
    }

    store.set('dock', this.settings);
    this.broadcast();
    void this.refresh();
  }

  /** Builds a native context menu for an icon. */
  openMenu(appKey: string, x: number, y: number): void {
    const app = this.snapshot.apps.find((entry) => entry.key === appKey);
    if (!app) return;

    const running = app.windows.length > 0;
    const items: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'New window',
        enabled: running,
        click: () => void this.launch(app.key, true),
      },
      {
        label: app.pinned ? 'Unpin from dock' : 'Pin to dock',
        click: () => this.setPinned(app.key, !app.pinned),
      },
    ];

    if (running) {
      items.push({ type: 'separator' });
      items.push({
        label: app.windows.length === 1 ? 'Close window' : `Close all ${app.windows.length} windows`,
        click: () => void this.closeAll(app.key),
      });
    }

    // macOS/Linux forbid a menu without items; these two always exist.
    Menu.buildFromTemplate(items).popup({
      x: Math.round(x),
      y: Math.round(y),
      callback: () => this.broadcast(),
    });
  }

  // ----------------------------------------------------------------- helpers

  private broadcast(): void {
    this.dock.send('dock:windows', this.snapshot);
  }

  /**
   * Drops docks, panels, and desktop windows from the app list.
   *
   * `wmctrl` lists every managed top-level window, which includes Plank and Nemo's
   * desktop window; `_NET_WM_WINDOW_TYPE` is the reliable way to tell them apart.
   * The type is queried once per window id and cached.
   */
  private async filterNonApps(
    windows: Omit<DockWindowInfo, 'minimized' | 'focused'>[],
  ): Promise<Omit<DockWindowInfo, 'minimized' | 'focused'>[]> {
    const present = new Set(windows.map((window) => window.id));
    for (const id of this.ignoredWindows.keys()) {
      if (!present.has(id)) this.ignoredWindows.delete(id);
    }

    await Promise.all(
      windows.map(async (window) => {
        if (this.ignoredWindows.has(window.id)) return;
        this.ignoredWindows.set(window.id, await x11.isDockOrDesktop(window.id));
      }),
    );

    return windows.filter((window) => !this.ignoredWindows.get(window.id));
  }

  private buildPinnedOnly(): DockApp[] {
    return this.settings.pinned.map((pinned) => ({
      key: pinned.key,
      name: pinned.name,
      icon: this.iconFor(pinned.icon),
      pinned: true,
      launching: false,
      windows: [],
    }));
  }

  private matchPinned(
    pinned: DockPinnedApp,
    grouped: Map<string, { key: string; name: string; windows: DockApp['windows'] }>,
  ): { key: string; name: string; windows: DockApp['windows'] } | undefined {
    const entry = findEntry(pinned.key);
    const targets = new Set<string>();
    if (pinned.wmClass) targets.add(pinned.wmClass.toLowerCase());
    if (entry?.startupWmClass) targets.add(entry.startupWmClass.toLowerCase());
    targets.add(pinned.key.toLowerCase());

    for (const bucket of grouped.values()) {
      for (const window of bucket.windows) {
        const wmClass = window.wmClass.toLowerCase();
        const instance = wmClass.split('.')[0];
        if (targets.has(wmClass) || targets.has(instance)) return bucket;
        if (desktopIdForWmClass(window.wmClass) === pinned.key) return bucket;
      }
    }

    return undefined;
  }

  private pinnedFromRunning(appKey: string): DockPinnedApp | null {
    const app = this.snapshot.apps.find((entry) => entry.key === appKey);
    const wmClass = app?.windows[0]?.wmClass ?? '';
    const desktopId = desktopIdForWmClass(wmClass);
    if (desktopId) return pinnedFromDesktopId(desktopId);
    if (!app) return null;
    return {
      key: app.key,
      name: app.name,
      icon: '',
      desktopFile: '',
      wmClass,
    };
  }

  private seedPinned(): void {
    const seeded = readPlankLaunchers();
    if (seeded.length) {
      this.settings.pinned = seeded;
    }
    this.settings.pinnedSeeded = true;
    store.set('dock', this.settings);
  }

  /** Icons are resolved to data URLs once and cached; the renderer only sees strings. */
  private iconFor(icon: string): string {
    if (!icon) return '';
    const cached = ICON_CACHE.get(icon);
    if (cached !== undefined) return cached;

    const file = resolveIconPath(icon);
    if (!file) {
      ICON_CACHE.set(icon, '');
      return '';
    }

    try {
      // `nativeImage` cannot decode SVG (the Papirus theme is mostly SVG), so those
      // are passed through as data URLs and rasterized by Chromium instead.
      const value = file.toLowerCase().endsWith('.svg')
        ? `data:image/svg+xml;base64,${readFileSync(file).toString('base64')}`
        : (() => {
            const image = nativeImage.createFromPath(file);
            return image.isEmpty() ? '' : image.resize({ width: 128, height: 128 }).toDataURL();
          })();

      if (ICON_CACHE.size > ICON_CACHE_LIMIT) ICON_CACHE.clear();
      ICON_CACHE.set(icon, value);
      return value;
    } catch {
      ICON_CACHE.set(icon, '');
      return '';
    }
  }

  private isBouncing(appKey: string): boolean {
    const until = this.bounceUntil.get(appKey);
    return until !== undefined && Date.now() < until;
  }

  private markBouncing(appKey: string): void {
    this.bounceUntil.set(appKey, Date.now() + BOUNCE_MS);
  }

  private clearBounce(appKey: string): void {
    this.bounceUntil.delete(appKey);
  }
}

/** `google-chrome` → `Google Chrome`; `gnome-terminal-server` → `Gnome Terminal Server`. */
function windowDisplayName(wmClass: string): string {
  const instance = (wmClass || '').split('.')[0] || 'App';
  return instance
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
