import { BrowserWindow, nativeTheme, screen, type WebContents } from 'electron';
import path from 'node:path';
import { defaultConfig, sizeForPreset, type SizePreset } from '../shared/config/index.js';
import { defaultWidgetState } from '../shared/config/settings.js';
import { IPC } from '../shared/ipc.js';
import type { SettingsSnapshot, WidgetBounds, WidgetContext, WidgetState } from '../shared/types.js';
import { WIDGETS, WIDGET_IDS, type WidgetDefinition, type WidgetId } from '../shared/widgets.js';
import { debounce } from './debounce.js';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';
import { getSettingsWindow } from './settingsWindow.js';
import {
  getSettings,
  getWidgetConfig,
  patchWidgetState,
  readWidgetState,
  setWidgetVisible as persistVisible,
  writeWidgetState,
} from './settings.js';

const LINUX = process.platform === 'linux';
const RENDERER_PATH = path.join(RENDERER_DIR, 'widget.html');

const windows = new Map<WidgetId, BrowserWindow>();

export function getWidgetWindow(id: WidgetId): BrowserWindow | undefined {
  return windows.get(id);
}

export function buildContext(id: WidgetId): WidgetContext {
  const settings = getSettings();
  const config = getWidgetConfig(id);
  return {
    id,
    theme: settings.theme,
    resolvedTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    locked: settings.locked || config.locked === true,
    weather: settings.weather,
    config,
  };
}

export function settingsSnapshot(): SettingsSnapshot {
  return {
    settings: getSettings(),
    resolvedTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  };
}

export function broadcastSnapshot(): void {
  const snapshot = settingsSnapshot();
  broadcast(IPC.settingsSnapshot, snapshot);

  const settings = getSettingsWindow();
  if (settings) settings.webContents.send(IPC.settingsSnapshot, snapshot);
}

export function broadcastContext(): void {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) win.webContents.send(IPC.settings, buildContext(id));
  }
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function widgetIdForWebContents(contents: WebContents): WidgetId | null {
  const win = BrowserWindow.fromWebContents(contents);
  if (!win) return null;
  for (const [id, candidate] of windows) {
    if (candidate === win) return id;
  }
  return null;
}

function clampToDisplay(bounds: WidgetBounds): WidgetBounds {
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(Math.max(bounds.width, 160), area.width);
  const height = Math.min(Math.max(bounds.height, 120), area.height);
  const x = Math.min(Math.max(bounds.x, area.x - width + 80), area.x + area.width - 80);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - 80);
  return { x, y, width, height };
}

let spawnCursor: { x: number; y: number } | null = null;

/** Packs newly opened widgets down the right edge, wrapping into a new column. */
function nextSpawnBounds(definition: WidgetDefinition): WidgetBounds {
  const area = screen.getPrimaryDisplay().workArea;
  const margin = 28;
  const gap = 16;

  if (!spawnCursor) spawnCursor = { x: area.x + area.width - margin, y: area.y + margin };

  let x = spawnCursor.x - definition.width;
  let y = spawnCursor.y;

  if (y + definition.height > area.y + area.height - margin) {
    spawnCursor.x = x - margin;
    spawnCursor.y = area.y + margin;
    x = spawnCursor.x - definition.width;
    y = spawnCursor.y;
  }

  spawnCursor.y = y + definition.height + gap;
  return clampToDisplay({ x, y, width: definition.width, height: definition.height });
}

/**
 * Pins a widget below every app window and shows it on all workspaces.
 * The workspace hint is dropped until the window is mapped, so this must run
 * after each show, not just at creation.
 */
function applyDesktopLayer(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
}

export function createWidget(id: WidgetId): BrowserWindow {
  const existing = windows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.showInactive();
    return existing;
  }

  const definition = WIDGETS[id];
  const saved = readWidgetState(id);
  const config = saved?.config ?? defaultConfig(definition.config);
  const bounds = clampToDisplay(saved ?? nextSpawnBounds(definition));
  const locked = getSettings().locked || config.locked === true;

  const win = new BrowserWindow({
    ...bounds,
    minWidth: definition.minWidth,
    minHeight: definition.minHeight,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: !locked,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    acceptFirstMouse: true,
    show: false,
    ...(LINUX ? { type: 'desktop' as const } : {}),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  windows.set(id, win);
  if (!saved) writeWidgetState(id, defaultWidgetState(id, bounds, true));

  // Keep a useful title for window tools; the page would otherwise overwrite it.
  win.on('page-title-updated', (event) => event.preventDefault());
  win.setTitle(`Desktop Widget · ${definition.title}`);

  // Desktop layer: never above app windows, visible on every workspace.
  win.setAlwaysOnTop(false);

  // Keep it pinned below the stack and on every workspace after show/hide cycles.
  win.on('show', () => applyDesktopLayer(win));

  // Chromium inflates frameless transparent windows by a few pixels on
  // fractional X11 scaling. Persisting that startup geometry would compound on
  // every launch, so only save after the window has settled and moved for real.
  let settled = false;
  let dirty = false;
  setTimeout(() => {
    settled = true;
  }, 1500);

  const persist = debounce(() => {
    if (win.isDestroyed() || !dirty) return;
    patchWidgetState(id, win.getBounds());
  }, 250);

  const handleGeometry = () => {
    if (!settled) return;
    // A move under fractional scaling can emit a spurious resize; don't record it.
    if (drag?.id === id) return;
    dirty = true;
    persist();
  };

  // Linux emits move/resize while dragging; macOS/Windows also emit the
  // past-tense variants. Listen to both and let the debounce coalesce them.
  win.on('move', handleGeometry);
  win.on('resize', handleGeometry);
  win.on('moved', handleGeometry);
  win.on('resized', handleGeometry);
  win.on('close', () => {
    if (win.isDestroyed() || !dirty) return;
    patchWidgetState(id, win.getBounds());
  });
  win.on('closed', () => {
    persist.cancel();
    windows.delete(id);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[widget:${id}] renderer exited: ${details.reason}`);
  });

  win.once('ready-to-show', () => {
    if (getSettings().widgets[id]?.visible === false) return;
    // The 'show' handler applies the workspace + below hints once the window
    // is mapped.
    win.showInactive();
  });

  if (DEV_SERVER_URL) void win.loadURL(`${DEV_SERVER_URL}/widget.html?widget=${id}`);
  else void win.loadFile(RENDERER_PATH, { query: { widget: id } });

  return win;
}

export function setWidgetVisible(id: WidgetId, visible: boolean): void {
  if (!visible) {
    const win = windows.get(id);
    if (win && !win.isDestroyed()) win.hide();
    persistVisible(id, false);
    return;
  }

  const win = windows.get(id);
  if (!win || win.isDestroyed()) {
    // Mark it visible first: createWidget skips showing windows saved as hidden.
    persistVisible(id, true);
    createWidget(id);
    return;
  }

  win.showInactive();
  persistVisible(id, true);
}

export function isWidgetVisible(id: WidgetId): boolean {
  const win = windows.get(id);
  return Boolean(win && !win.isDestroyed() && win.isVisible());
}

export function anyWidgetVisible(): boolean {
  return WIDGET_IDS.some((id) => isWidgetVisible(id));
}

export function showAll(): void {
  for (const id of WIDGET_IDS) setWidgetVisible(id, true);
}

export function hideAll(): void {
  for (const id of WIDGET_IDS) {
    if (windows.has(id)) setWidgetVisible(id, false);
  }
}

export function toggleAll(): void {
  if (anyWidgetVisible()) hideAll();
  else showAll();
}

export function applyLocked(locked: boolean): void {
  for (const [id, win] of windows) {
    if (!win.isDestroyed()) win.setResizable(!(locked || getWidgetConfig(id).locked === true));
  }
  broadcastContext();
  broadcastSnapshot();
}

/** Closes or creates the widget window immediately. */
export function setWidgetEnabled(id: WidgetId, enabled: boolean): void {
  if (enabled) {
    const existing = windows.get(id);
    if (existing && !existing.isDestroyed()) {
      persistVisible(id, true);
      existing.showInactive();
    } else {
      if (readWidgetState(id)) persistVisible(id, true);
      createWidget(id);
    }
  } else {
    const win = windows.get(id);
    if (win && !win.isDestroyed()) win.close();

    if (readWidgetState(id)) persistVisible(id, false);
    else writeWidgetState(id, defaultWidgetState(id, clampToDisplay(nextSpawnBounds(WIDGETS[id])), false));
  }

  broadcastContext();
  broadcastSnapshot();
}

export function applyWidgetConfig(id: WidgetId, config: WidgetState['config']): void {
  const win = windows.get(id);
  if (!win || win.isDestroyed()) return;
  win.setResizable(!(getSettings().locked || config.locked === true));
}

/** Applies a size preset, or explicit dimensions for a custom size. */
export function applyWidgetSize(id: WidgetId, preset: SizePreset, custom?: { width: number; height: number }): void {
  const definition = WIDGETS[id];
  const dims = custom ?? (preset === 'custom' ? null : sizeForPreset(definition, preset));
  if (!dims) return;

  const win = windows.get(id);
  if (win && !win.isDestroyed()) {
    const [x, y] = win.getPosition();
    const bounds = clampToDisplay({ x, y, width: dims.width, height: dims.height });
    win.setBounds(bounds);
    patchWidgetState(id, bounds);
    return;
  }

  patchWidgetState(id, {
    width: Math.max(definition.minWidth, Math.round(dims.width)),
    height: Math.max(definition.minHeight, Math.round(dims.height)),
  });
}

export async function captureWidget(id: WidgetId): Promise<string | null> {
  const win = windows.get(id);
  if (!win || win.isDestroyed() || !win.isVisible()) return null;
  try {
    const image = await win.webContents.capturePage();
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}

/** Resets config + size to defaults, keeping visibility and position. */
export function resetWidgets(id?: WidgetId): void {
  for (const widgetId of id ? [id] : WIDGET_IDS) {
    const definition = WIDGETS[widgetId];
    const state = readWidgetState(widgetId);
    if (!state) continue;

    const config = defaultConfig(definition.config);
    const win = windows.get(widgetId);

    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      const bounds = clampToDisplay({ x, y, width: definition.width, height: definition.height });
      win.setBounds(bounds);
      writeWidgetState(widgetId, { ...bounds, visible: true, config });
      win.setResizable(!getSettings().locked);
    } else {
      patchWidgetState(widgetId, { width: definition.width, height: definition.height, config });
    }
  }

  broadcastContext();
  broadcastSnapshot();
}

interface DragState {
  id: WidgetId;
  origin: { x: number; y: number };
  start: { x: number; y: number };
  size: { width: number; height: number };
}

let drag: DragState | null = null;

/**
 * Dragging is driven by the renderer: Chromium's drag regions do not reliably
 * start a native move for transparent frameless windows on X11, so the renderer
 * streams pointer deltas and we reposition the window here.
 */
export function beginDrag(id: WidgetId, screenX: number, screenY: number): void {
  const win = windows.get(id);
  if (!win || win.isDestroyed()) return;

  const [x, y] = win.getPosition();
  const current = win.getBounds();
  // Prefer the persisted size: the live bounds include the fractional-scale
  // inflation and would otherwise bake it in on every drag.
  const stored = readWidgetState(id);
  drag = {
    id,
    origin: { x, y },
    start: { x: screenX, y: screenY },
    size: { width: stored?.width ?? current.width, height: stored?.height ?? current.height },
  };
}

export function updateDrag(id: WidgetId, screenX: number, screenY: number): void {
  if (!drag || drag.id !== id) return;
  const win = windows.get(id);
  if (!win || win.isDestroyed()) return;

  // Fractional scaling makes a plain move inflate the window by a few pixels,
  // so pin the intended size while relocating it.
  win.setBounds(
    clampToDisplay({
      x: drag.origin.x + Math.round(screenX - drag.start.x),
      y: drag.origin.y + Math.round(screenY - drag.start.y),
      width: drag.size.width,
      height: drag.size.height,
    }),
  );
}

export function endDrag(): void {
  const finished = drag;
  drag = null;
  if (!finished) return;

  const win = windows.get(finished.id);
  if (!win || win.isDestroyed()) return;

  const bounds = win.getBounds();
  patchWidgetState(finished.id, {
    x: bounds.x,
    y: bounds.y,
    width: finished.size.width,
    height: finished.size.height,
  });
}

export function reloadAll(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
  }
}
