import { app, ipcMain, nativeTheme, powerMonitor } from 'electron';
import { isHexColor, isRecord, isSizePreset } from '../shared/config/index.js';
import { mergeDockSettings } from '../shared/config/dock.js';
import { IPC } from '../shared/ipc.js';
import type { ThemeSettings, WidgetUpdateResult } from '../shared/types.js';
import { WIDGET_IDS, isWidgetId } from '../shared/widgets.js';
import { applyAutostart } from './autolaunch.js';
import { openCityEditor } from './cityEditor.js';
import {
  getSettings,
  mergeWidgetConfig,
  migrateSettings,
  store,
} from './settings.js';
import { openSettings } from './settingsWindow.js';
import { applyDockIcon, destroyDockIcon } from './dockIcon.js';
import { DockController } from './dock.js';
import { setPlankEnabled, startPlank, stopPlank } from './plank.js';
import { markQuitting } from './appState.js';
import { deleteReminder, listReminders, saveReminder } from './reminders.js';
import { openReminderEditor } from './reminderEditor.js';
import { checkReminders, startReminderScheduler } from './reminderScheduler.js';
import { sampleSystemStats } from './systemStats.js';
import { initTheme, setAccent, setThemeMode } from './theme.js';
import { createTray, destroyTray, refreshTray } from './tray.js';
import { ensureWeatherDefaults, getWeather, setWeatherCity } from './weather.js';
import * as wm from './windowManager.js';

const VALID_MODES: ThemeSettings['mode'][] = ['dark', 'light', 'system'];

let dockController: DockController | null = null;

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function applySettingsPatch(raw: unknown): void {
  if (!isRecord(raw)) return;

  const theme = isRecord(raw.theme) ? raw.theme : null;
  if (theme) {
    if (typeof theme.mode === 'string' && VALID_MODES.includes(theme.mode as ThemeSettings['mode'])) {
      setThemeMode(theme.mode as ThemeSettings['mode']);
    }
    if (isHexColor(theme.accent)) setAccent(theme.accent);
  }

  if (typeof raw.locked === 'boolean') {
    store.set('locked', raw.locked);
    wm.applyLocked(raw.locked);
  }

  if (typeof raw.autostart === 'boolean') {
    store.set('autostart', raw.autostart);
    applyAutostart(raw.autostart);
  }

  if (typeof raw.keepDockIcon === 'boolean') {
    store.set('keepDockIcon', raw.keepDockIcon);
    applyDockIcon(raw.keepDockIcon);
  }

  if (isRecord(raw.dock)) {
    const current = getSettings().dock;
    const merged = mergeDockSettings(current, raw.dock);
    store.set('dock', merged);

    if (merged.replacePlank !== current.replacePlank) setPlankEnabled(!merged.replacePlank);

    dockController?.applySettings(merged);
  }

  const weather = isRecord(raw.weather) ? raw.weather : null;
  if (weather) {
    const current = getSettings().weather;
    store.set('weather', {
      city: typeof weather.city === 'string' ? weather.city.slice(0, 120) : current.city,
      latitude: isCoordinate(weather.latitude) ? weather.latitude : current.latitude,
      longitude: isCoordinate(weather.longitude) ? weather.longitude : current.longitude,
      units: weather.units === 'imperial' ? 'imperial' : weather.units === 'metric' ? 'metric' : current.units,
    });
  }

  wm.broadcastContext();
  wm.broadcastSnapshot();
  refreshTray();
}

// Needed on some X11 drivers for per-pixel transparency.
app.commandLine.appendSwitch('enable-transparent-visuals');

function registerIpc(): void {
  ipcMain.handle(IPC.context, (event) => {
    const id = wm.widgetIdForWebContents(event.sender);
    if (!id) throw new Error('Unknown widget window');
    return wm.buildContext(id);
  });

  ipcMain.handle(IPC.statsGet, () => sampleSystemStats());

  ipcMain.handle(IPC.weatherGet, () => getWeather());

  ipcMain.handle(IPC.weatherSetCity, async (_event, city: unknown) => {
    const trimmed = typeof city === 'string' ? city.trim() : '';
    if (!trimmed) return { ok: false, error: 'Type a city name.' };

    try {
      const place = await setWeatherCity(trimmed);
      if (!place) return { ok: false, error: `No match for “${trimmed}”.` };

      wm.broadcast(IPC.weather, await getWeather(true));
      refreshTray();
      return { ok: true, name: place.name };
    } catch (error) {
      console.error('[ipc] city lookup failed', error);
      return { ok: false, error: 'Lookup failed — check the connection.' };
    }
  });

  ipcMain.handle(IPC.weatherOpenEditor, () => {
    openCityEditor(getSettings().weather.city);
  });

  ipcMain.handle(IPC.remindersGet, () => listReminders());

  ipcMain.handle(IPC.remindersSave, (_event, draft: unknown) => {
    const next = saveReminder(draft);
    checkReminders();
    return next;
  });

  ipcMain.handle(IPC.remindersDelete, (_event, id: unknown) => {
    const next = deleteReminder(id);
    checkReminders();
    return next;
  });

  ipcMain.handle(IPC.remindersOpenEditor, () => openReminderEditor());

  ipcMain.handle(IPC.appearanceGet, () => ({
    theme: getSettings().theme,
    resolvedTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  }));

  ipcMain.on(IPC.dragStart, (event, screenX: unknown, screenY: unknown) => {
    const id = wm.widgetIdForWebContents(event.sender);
    if (!id || !isCoordinate(screenX) || !isCoordinate(screenY)) return;
    wm.beginDrag(id, screenX, screenY);
  });

  ipcMain.on(IPC.dragMove, (event, screenX: unknown, screenY: unknown) => {
    const id = wm.widgetIdForWebContents(event.sender);
    if (!id || !isCoordinate(screenX) || !isCoordinate(screenY)) return;
    wm.updateDrag(id, screenX, screenY);
  });

  ipcMain.on(IPC.dragEnd, () => wm.endDrag());

  ipcMain.on(IPC.resizeStart, (event, edge: unknown, screenX: unknown, screenY: unknown) => {
    const id = wm.widgetIdForWebContents(event.sender);
    if (!id || typeof edge !== 'string' || !isCoordinate(screenX) || !isCoordinate(screenY)) return;
    wm.beginResize(id, edge, screenX, screenY);
  });

  ipcMain.on(IPC.resizeMove, (event, screenX: unknown, screenY: unknown) => {
    if (!wm.widgetIdForWebContents(event.sender)) return;
    if (!isCoordinate(screenX) || !isCoordinate(screenY)) return;
    wm.updateResize(screenX, screenY);
  });

  ipcMain.on(IPC.resizeEnd, () => wm.endResize());

  ipcMain.handle(IPC.themeSet, (_event, patch: Partial<ThemeSettings>) => {
    if (patch?.mode && VALID_MODES.includes(patch.mode)) setThemeMode(patch.mode);
    if (typeof patch?.accent === 'string' && /^#[0-9a-f]{6}$/i.test(patch.accent)) setAccent(patch.accent);
    refreshTray();
  });

  ipcMain.handle(IPC.settingsGet, () => wm.settingsSnapshot());

  ipcMain.handle(IPC.settingsSet, (_event, patch: unknown) => {
    applySettingsPatch(patch);
    return wm.settingsSnapshot();
  });

  ipcMain.handle(IPC.settingsOpen, () => openSettings());

  ipcMain.handle(IPC.appQuit, () => app.quit());

  ipcMain.handle(IPC.widgetToggle, (_event, payload: unknown) => {
    if (!isRecord(payload) || !isWidgetId(payload.id) || typeof payload.enabled !== 'boolean') {
      throw new Error('Invalid widget toggle');
    }
    wm.setWidgetEnabled(payload.id, payload.enabled);
    refreshTray();
    return wm.settingsSnapshot();
  });

  ipcMain.handle(IPC.widgetUpdate, async (_event, payload: unknown): Promise<WidgetUpdateResult> => {
    if (!isRecord(payload) || !isWidgetId(payload.id)) {
      return { ok: false, error: 'Unknown widget.', snapshot: wm.settingsSnapshot() };
    }

    const id = payload.id;
    const configPatch = isRecord(payload.config) ? payload.config : null;
    let error: string | undefined;

    if (configPatch) {
      const merged = mergeWidgetConfig(id, configPatch);

      // Weather is a single global source, so its fields update app-wide state.
      if (id === 'weather') {
        const current = getSettings().weather;
        if (configPatch.units === 'metric' || configPatch.units === 'imperial') {
          if (configPatch.units !== current.units) {
            store.set('weather', { ...current, units: configPatch.units });
            wm.broadcast(IPC.weather, await getWeather(true));
          }
        }

        const city = typeof configPatch.city === 'string' ? configPatch.city.trim() : '';
        if (city) {
          const place = await setWeatherCity(city);
          if (!place) error = `No match for “${city}”.`;
          else {
            wm.broadcast(IPC.weather, await getWeather(true));
            refreshTray();
          }
        }
      }

      if ('size' in configPatch && isSizePreset(merged.size)) {
        wm.applyWidgetSize(id, merged.size);
      }

      wm.applyWidgetConfig(id, merged);
    }

    if (isRecord(payload.size) && isCoordinate(payload.size.width) && isCoordinate(payload.size.height)) {
      mergeWidgetConfig(id, { size: 'custom' });
      wm.applyWidgetSize(id, 'custom', { width: payload.size.width, height: payload.size.height });
    }

    wm.broadcastContext();
    wm.broadcastSnapshot();

    return { ok: !error, error, snapshot: wm.settingsSnapshot() };
  });

  ipcMain.handle(IPC.widgetReset, (_event, payload: unknown) => {
    const id = isRecord(payload) && isWidgetId(payload.id) ? payload.id : undefined;
    wm.resetWidgets(id);
    refreshTray();
    return wm.settingsSnapshot();
  });

  ipcMain.handle(IPC.widgetReload, () => wm.reloadAll());

  ipcMain.handle(IPC.widgetCapture, (_event, id: unknown) => (isWidgetId(id) ? wm.captureWidget(id) : null));

  ipcMain.handle(IPC.dockStatus, () => dockController?.status() ?? null);

  ipcMain.on(IPC.dockRefresh, () => void dockController?.refresh());

  ipcMain.on(IPC.dockHoverStart, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string' || !isRecord(payload.iconRect)) return;
    const rect = payload.iconRect;
    if (!isCoordinate(rect.x) || !isCoordinate(rect.y) || !isCoordinate(rect.width) || !isCoordinate(rect.height)) {
      return;
    }
    dockController?.hoverStart(payload.appKey, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  });

  ipcMain.on(IPC.dockHoverEnd, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string') return;
    dockController?.hoverEnd(payload.appKey);
  });

  ipcMain.on(IPC.dockPreviewEnter, () => dockController?.previewEnter());
  ipcMain.on(IPC.dockPreviewLeave, () => dockController?.previewLeave());
  ipcMain.on(IPC.dockPreviewReady, () => dockController?.previewReady());

  ipcMain.on(IPC.dockFocus, (_event, payload: unknown) => {
    if (!isRecord(payload) || !isCoordinate(payload.windowId)) return;
    void dockController?.focusWindow(payload.windowId);
  });

  ipcMain.on(IPC.dockClose, (_event, payload: unknown) => {
    if (!isRecord(payload) || !isCoordinate(payload.windowId)) return;
    void dockController?.closeWindow(payload.windowId);
  });

  ipcMain.on(IPC.dockCloseAll, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string') return;
    void dockController?.closeAll(payload.appKey);
  });

  ipcMain.on(IPC.dockLaunch, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string') return;
    void dockController?.launch(payload.appKey, payload.newWindow === true);
  });

  ipcMain.on(IPC.dockMenu, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string') return;
    if (!isCoordinate(payload.x) || !isCoordinate(payload.y)) return;
    dockController?.openMenu(payload.appKey, payload.x, payload.y);
  });

  ipcMain.handle(IPC.dockPin, (_event, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.appKey !== 'string') return;
    if (typeof payload.pinned !== 'boolean') return;
    dockController?.setPinned(payload.appKey, payload.pinned);
  });

  ipcMain.on(IPC.dockSize, (_event, payload: unknown) => {
    if (!isRecord(payload) || !isCoordinate(payload.width) || !isCoordinate(payload.height)) return;
    dockController?.resizeToContent(payload.width, payload.height);
  });

  ipcMain.on(IPC.dockReveal, () => dockController?.reveal());

  ipcMain.handle(IPC.dockStopPlank, () => stopPlank());
  ipcMain.handle(IPC.dockRestartPlank, async () => {
    setPlankEnabled(true);
    store.set('dock', { ...getSettings().dock, replacePlank: false });
    dockController?.applySettings(getSettings().dock);
    await startPlank();
  });
}

function startLoops(): void {
  const pushStats = async () => wm.broadcast(IPC.stats, await sampleSystemStats());
  void pushStats();
  setInterval(pushStats, 1500);

  const pushWeather = async () => {
    const snapshot = await getWeather();
    wm.broadcast(IPC.weather, snapshot);
    // Retry quickly after a failed lookup; otherwise poll every 15 minutes.
    setTimeout(pushWeather, snapshot ? 15 * 60 * 1000 : 60 * 1000);
  };
  void pushWeather();
}

function start(): void {
  migrateSettings();
  registerIpc();
  initTheme();
  ensureWeatherDefaults();
  applyAutostart(getSettings().autostart);

  for (const id of WIDGET_IDS) {
    const state = getSettings().widgets[id];
    if (!state || state.visible) wm.createWidget(id);
  }

  powerMonitor.on('resume', () => wm.broadcast(IPC.resume, Date.now()));

  createTray();
  applyDockIcon(getSettings().keepDockIcon);
  startLoops();
  startReminderScheduler();

  const dockSettings = getSettings().dock;
  dockController = new DockController(dockSettings);
  dockController.start();
  // Disable Plank's autostart entry only once the user has opted in.
  if (dockSettings.enabled && dockSettings.replacePlank) setPlankEnabled(false);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openSettings());

  app.whenReady().then(start);

  // Widgets may all be hidden; the tray keeps the app alive.
  app.on('window-all-closed', () => {});
  app.on('activate', () => openSettings());
  app.on('before-quit', () => {
    markQuitting();
    dockController?.stop();
    destroyDockIcon();
    destroyTray();
  });
}
