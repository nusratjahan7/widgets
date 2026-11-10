import { app, ipcMain, nativeTheme, powerMonitor, screen } from 'electron';
import { isHexColor, isRecord, isSizePreset } from '../shared/config/index.js';
import { IPC } from '../shared/ipc.js';
import { PANEL_LIMITS } from '../shared/clipboard-panel/types.js';
import type { ThemeSettings, WidgetUpdateResult } from '../shared/types.js';
import { WIDGET_IDS, isWidgetId } from '../shared/widgets.js';
import { AUTOSTART_HIDDEN_FLAG, applyAutostart } from './autolaunch.js';
import { openCityEditor } from './cityEditor.js';
import {
  ClipboardPanelController,
  getClipboardPanel,
  registerPanelMediaScheme,
  servePanelMedia,
  setClipboardPanel,
} from './clipboard-panel/index.js';
import * as clipboardHistory from './clipboard-panel/history.js';
import * as clipboardRecents from './clipboard-panel/recents.js';
import { searchKlipy } from './clipboard-panel/klipy.js';
import {
  getSettings,
  mergeWidgetConfig,
  migrateSettings,
  store,
} from './settings.js';
import { openSettings } from './settingsWindow.js';
import { applyDockIcon, destroyDockIcon } from './dockIcon.js';
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

let clipboardPanel: ClipboardPanelController | null = null;

registerPanelMediaScheme();

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

  if (isRecord(raw.clipboardPanel)) {
    const current = getSettings().clipboardPanel;
    const panel = raw.clipboardPanel;
    const merged = {
      enabled: typeof panel.enabled === 'boolean' ? panel.enabled : current.enabled,
      historyEnabled:
        typeof panel.historyEnabled === 'boolean' ? panel.historyEnabled : current.historyEnabled,
      autoPaste: typeof panel.autoPaste === 'boolean' ? panel.autoPaste : current.autoPaste,
      klipyApiKey:
        typeof panel.klipyApiKey === 'string'
          ? panel.klipyApiKey.trim().slice(0, PANEL_LIMITS.klipyKey)
          : current.klipyApiKey,
    };
    store.set('clipboardPanel', merged);
    clipboardPanel?.applySettings(merged);
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

  ipcMain.handle(IPC.panelToggle, () => clipboardPanel?.toggle());

  ipcMain.on(IPC.panelHide, () => clipboardPanel?.hide());

  ipcMain.on(IPC.panelDragStart, (_event, screenX: unknown, screenY: unknown) => {
    if (!isCoordinate(screenX) || !isCoordinate(screenY)) return;
    clipboardPanel?.beginDrag(screenX, screenY);
  });

  ipcMain.on(IPC.panelDragMove, (_event, screenX: unknown, screenY: unknown) => {
    if (!isCoordinate(screenX) || !isCoordinate(screenY)) return;
    clipboardPanel?.updateDrag(screenX, screenY);
  });

  ipcMain.on(IPC.panelDragEnd, () => clipboardPanel?.endDrag());

  ipcMain.handle(IPC.panelStatus, () => {
    return (
      clipboardPanel?.status() ?? {
        session: 'other',
        pasteTool: null,
        clipboardWatch: false,
        klipyConfigured: Boolean(getSettings().clipboardPanel.klipyApiKey),
      }
    );
  });

  ipcMain.handle(IPC.panelHistoryGet, () => clipboardHistory.list());
  ipcMain.handle(IPC.panelRecentsGet, () => clipboardRecents.list());

  ipcMain.handle(IPC.panelHistoryDelete, (_event, id: unknown) => clipboardHistory.remove(id));

  ipcMain.handle(IPC.panelHistoryClear, () => clipboardHistory.clear());

  ipcMain.handle(IPC.panelHistoryPin, (_event, payload: unknown) => {
    if (!isRecord(payload)) return clipboardHistory.list();
    return clipboardHistory.setPinned(payload.id, payload.pinned);
  });

  ipcMain.handle(IPC.panelUseItem, (_event, payload: unknown) => clipboardPanel?.useItem(payload));

  ipcMain.handle(IPC.panelKlipy, (_event, query: unknown) =>
    searchKlipy(typeof query === 'string' ? query : '', getSettings().clipboardPanel.klipyApiKey),
  );
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

const DISPLAY_READY_EDGE = 200;
const DISPLAY_SETTLE_MS = 1200;
const DISPLAY_READY_TIMEOUT_MS = 5000;

function displayReady(): boolean {
  return screen
    .getAllDisplays()
    .some(({ workArea }) => workArea.width >= DISPLAY_READY_EDGE && workArea.height >= DISPLAY_READY_EDGE);
}

/**
 * At login the panel/work area can still be configuring after app.whenReady().
 * Wait for a usable work area, then let the layout settle before placing widgets.
 */
function waitForDisplayReady(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let settle: NodeJS.Timeout | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (settle) clearTimeout(settle);
      screen.removeListener('display-added', check);
      screen.removeListener('display-metrics-changed', check);
      resolve();
    };

    const check = () => {
      if (done || !displayReady()) return;
      // Restart the settle window whenever the layout changes again.
      if (settle) clearTimeout(settle);
      settle = setTimeout(finish, DISPLAY_SETTLE_MS);
    };

    const timeout = setTimeout(finish, DISPLAY_READY_TIMEOUT_MS);
    screen.on('display-added', check);
    screen.on('display-metrics-changed', check);
    check();
  });
}

async function start(): Promise<void> {
  migrateSettings();
  registerIpc();
  initTheme();
  servePanelMedia();
  ensureWeatherDefaults();
  applyAutostart(getSettings().autostart);

  wm.watchDisplayChanges();
  if (wantsHidden) await waitForDisplayReady();

  for (const id of WIDGET_IDS) {
    const state = getSettings().widgets[id];
    if (!state || state.visible) wm.createWidget(id);
  }

  powerMonitor.on('resume', () => {
    wm.reclampAll();
    wm.broadcast(IPC.resume, Date.now());
  });

  createTray();
  applyDockIcon(getSettings().keepDockIcon);
  startLoops();
  startReminderScheduler();

  clipboardPanel = new ClipboardPanelController(getSettings().clipboardPanel);
  setClipboardPanel(clipboardPanel);
  void clipboardPanel.start();
}

const wantsToggle = process.argv.includes('--toggle');
const wantsHidden = process.argv.includes(AUTOSTART_HIDDEN_FLAG);

if (!app.requestSingleInstanceLock({ toggle: wantsToggle })) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, _workingDirectory, data) => {
    if ((isRecord(data) && data.toggle === true) || argv.includes('--toggle')) {
      getClipboardPanel()?.toggle();
      return;
    }
    // An autostart launch racing an existing instance must stay headless.
    if (argv.includes(AUTOSTART_HIDDEN_FLAG)) return;
    openSettings();
  });

  app.whenReady().then(async () => {
    await start();
    if (wantsToggle) getClipboardPanel()?.toggle();
  });

  // Widgets may all be hidden; the tray keeps the app alive.
  app.on('window-all-closed', () => {});
  app.on('activate', () => {
    if (wantsToggle || getClipboardPanel()?.isVisible()) return;
    openSettings();
  });
  app.on('before-quit', () => {
    markQuitting();
    wm.flushWidgetState();
    clipboardPanel?.stop();
    setClipboardPanel(null);
    destroyDockIcon();
    destroyTray();
  });
}
