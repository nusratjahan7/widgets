import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IpcChannels } from '../shared/ipc.js';
import type {
  Appearance,
  CityResult,
  Reminder,
  SettingsPatch,
  SettingsSnapshot,
  SystemStats,
  ThemeSettings,
  WeatherSnapshot,
  WidgetApi,
  WidgetContext,
  WidgetUpdate,
  WidgetUpdateResult,
} from '../shared/types.js';
import type {
  ClipboardHistoryItem,
  ClipboardPanelStatus,
  PanelRecentItem,
  PanelUseRequest,
  TenorSearchResult,
} from '../shared/clipboard-panel/types.js';
import type { WidgetId } from '../shared/widgets.js';

// Literal channel names, checked against the shared map at compile time so the
// preload stays CommonJS and never has to load an ES module at runtime.
const CHANNELS = {
  context: 'widget:context',
  settings: 'settings:changed',
  stats: 'stats:update',
  statsGet: 'stats:get',
  resume: 'widget:resume',
  weather: 'weather:update',
  weatherGet: 'weather:get',
  weatherSetCity: 'weather:set-city',
  weatherOpenEditor: 'weather:open-editor',
  remindersGet: 'reminders:get',
  remindersChange: 'reminders:change',
  remindersSave: 'reminders:save',
  remindersDelete: 'reminders:delete',
  remindersOpenEditor: 'reminders:open-editor',
  appearanceGet: 'appearance:get',
  themeSet: 'theme:set',
  dragStart: 'widget:drag-start',
  dragMove: 'widget:drag-move',
  dragEnd: 'widget:drag-end',
  resizeStart: 'widget:resize-start',
  resizeMove: 'widget:resize-move',
  resizeEnd: 'widget:resize-end',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsSnapshot: 'settings:snapshot',
  settingsOpen: 'settings:open',
  appQuit: 'app:quit',
  widgetToggle: 'widget:toggle',
  widgetUpdate: 'widget:update',
  widgetReset: 'widget:reset',
  widgetReload: 'widget:reload',
  widgetCapture: 'widget:capture',
  panelToggle: 'panel:toggle',
  panelHide: 'panel:hide',
  panelDragStart: 'panel:drag-start',
  panelDragMove: 'panel:drag-move',
  panelDragEnd: 'panel:drag-end',
  panelShown: 'panel:shown',
  panelStatus: 'panel:status',
  panelHistoryGet: 'panel:history-get',
  panelHistory: 'panel:history',
  panelRecentsGet: 'panel:recents-get',
  panelRecents: 'panel:recents',
  panelUseItem: 'panel:use-item',
  panelHistoryDelete: 'panel:history-delete',
  panelHistoryClear: 'panel:history-clear',
  panelHistoryPin: 'panel:history-pin',
  panelTenor: 'panel:tenor',
} as const satisfies IpcChannels;

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: WidgetApi = {
  getContext: () => ipcRenderer.invoke(CHANNELS.context) as Promise<WidgetContext>,
  onSettings: (callback) => subscribe<WidgetContext>(CHANNELS.settings, callback),
  onResume: (callback) => subscribe<number>(CHANNELS.resume, callback),
  onStats: (callback) => subscribe<SystemStats>(CHANNELS.stats, callback),
  getStats: () => ipcRenderer.invoke(CHANNELS.statsGet) as Promise<SystemStats>,
  onWeather: (callback) => subscribe<WeatherSnapshot | null>(CHANNELS.weather, callback),
  getWeather: () => ipcRenderer.invoke(CHANNELS.weatherGet) as Promise<WeatherSnapshot | null>,
  setWeatherCity: (city: string) => ipcRenderer.invoke(CHANNELS.weatherSetCity, city) as Promise<CityResult>,
  openCityEditor: () => ipcRenderer.invoke(CHANNELS.weatherOpenEditor) as Promise<void>,
  getReminders: () => ipcRenderer.invoke(CHANNELS.remindersGet) as Promise<Reminder[]>,
  onReminders: (callback) => subscribe<Reminder[]>(CHANNELS.remindersChange, callback),
  saveReminder: (draft) => ipcRenderer.invoke(CHANNELS.remindersSave, draft) as Promise<Reminder[]>,
  deleteReminder: (id: string) => ipcRenderer.invoke(CHANNELS.remindersDelete, id) as Promise<Reminder[]>,
  openReminderEditor: () => ipcRenderer.invoke(CHANNELS.remindersOpenEditor) as Promise<void>,
  getAppearance: () => ipcRenderer.invoke(CHANNELS.appearanceGet) as Promise<Appearance>,
  setTheme: (theme: Partial<ThemeSettings>) => ipcRenderer.invoke(CHANNELS.themeSet, theme) as Promise<void>,
  startDrag: (screenX, screenY) => ipcRenderer.send(CHANNELS.dragStart, screenX, screenY),
  dragTo: (screenX, screenY) => ipcRenderer.send(CHANNELS.dragMove, screenX, screenY),
  endDrag: () => ipcRenderer.send(CHANNELS.dragEnd),
  startResize: (edge, screenX, screenY) =>
    ipcRenderer.send(CHANNELS.resizeStart, edge, screenX, screenY),
  resizeTo: (screenX, screenY) => ipcRenderer.send(CHANNELS.resizeMove, screenX, screenY),
  endResize: () => ipcRenderer.send(CHANNELS.resizeEnd),

  getSettings: () => ipcRenderer.invoke(CHANNELS.settingsGet) as Promise<SettingsSnapshot>,
  setSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke(CHANNELS.settingsSet, patch) as Promise<SettingsSnapshot>,
  onSettingsSnapshot: (callback) =>
    subscribe<SettingsSnapshot>(CHANNELS.settingsSnapshot, callback),
  toggleWidget: (id: WidgetId, enabled: boolean) =>
    ipcRenderer.invoke(CHANNELS.widgetToggle, { id, enabled }) as Promise<SettingsSnapshot>,
  updateWidget: (update: WidgetUpdate) =>
    ipcRenderer.invoke(CHANNELS.widgetUpdate, update) as Promise<WidgetUpdateResult>,
  resetWidgets: (id?: WidgetId) =>
    ipcRenderer.invoke(CHANNELS.widgetReset, id ? { id } : {}) as Promise<SettingsSnapshot>,
  reloadWidgets: () => ipcRenderer.invoke(CHANNELS.widgetReload) as Promise<void>,
  captureWidget: (id: WidgetId) =>
    ipcRenderer.invoke(CHANNELS.widgetCapture, id) as Promise<string | null>,
  openSettings: () => ipcRenderer.invoke(CHANNELS.settingsOpen) as Promise<void>,
  quitApp: () => ipcRenderer.invoke(CHANNELS.appQuit) as Promise<void>,

  toggleClipboardPanel: () => ipcRenderer.invoke(CHANNELS.panelToggle) as Promise<void>,
  hideClipboardPanel: () => ipcRenderer.send(CHANNELS.panelHide),
  startPanelDrag: (screenX, screenY) =>
    ipcRenderer.send(CHANNELS.panelDragStart, screenX, screenY),
  dragPanelTo: (screenX, screenY) => ipcRenderer.send(CHANNELS.panelDragMove, screenX, screenY),
  endPanelDrag: () => ipcRenderer.send(CHANNELS.panelDragEnd),
  onClipboardPanelShown: (callback) => subscribe<void>(CHANNELS.panelShown, callback),
  getClipboardPanelStatus: () =>
    ipcRenderer.invoke(CHANNELS.panelStatus) as Promise<ClipboardPanelStatus>,
  getClipboardHistory: () =>
    ipcRenderer.invoke(CHANNELS.panelHistoryGet) as Promise<ClipboardHistoryItem[]>,
  onClipboardHistory: (callback) => subscribe<ClipboardHistoryItem[]>(CHANNELS.panelHistory, callback),
  deleteClipboardItem: (id: string) =>
    ipcRenderer.invoke(CHANNELS.panelHistoryDelete, id) as Promise<ClipboardHistoryItem[]>,
  clearClipboardHistory: () =>
    ipcRenderer.invoke(CHANNELS.panelHistoryClear) as Promise<ClipboardHistoryItem[]>,
  pinClipboardItem: (id: string, pinned: boolean) =>
    ipcRenderer.invoke(CHANNELS.panelHistoryPin, { id, pinned }) as Promise<ClipboardHistoryItem[]>,
  useClipboardPanelItem: (request: PanelUseRequest) =>
    ipcRenderer.invoke(CHANNELS.panelUseItem, request) as Promise<void>,
  getPanelRecents: () => ipcRenderer.invoke(CHANNELS.panelRecentsGet) as Promise<PanelRecentItem[]>,
  onPanelRecents: (callback) => subscribe<PanelRecentItem[]>(CHANNELS.panelRecents, callback),
  searchTenor: (query: string) =>
    ipcRenderer.invoke(CHANNELS.panelTenor, query) as Promise<TenorSearchResult>,
};

contextBridge.exposeInMainWorld('widgets', api);
