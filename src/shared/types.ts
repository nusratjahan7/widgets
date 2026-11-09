import type { WidgetConfig } from './config/types.js';
import type {
  ClipboardHistoryItem,
  ClipboardPanelSettings,
  ClipboardPanelStatus,
  PanelRecentItem,
  PanelUseRequest,
  TenorSearchResult,
} from './clipboard-panel/types.js';
import type { DockPreviewPayload, DockRect, DockSettings, DockSnapshot, DockStatus } from './dock.js';
import type { WidgetId } from './widgets.js';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type WeatherUnits = 'metric' | 'imperial';

export interface ThemeSettings {
  mode: ThemeMode;
  accent: string;
}

export interface WeatherSettings {
  city: string;
  latitude: number | null;
  longitude: number | null;
  units: WeatherUnits;
}

export interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetState extends WidgetBounds {
  visible: boolean;
  config: WidgetConfig;
}

export type Settings = {
  theme: ThemeSettings;
  locked: boolean;
  autostart: boolean;
  keepDockIcon: boolean;
  weather: WeatherSettings;
  dock: DockSettings;
  clipboardPanel: ClipboardPanelSettings;
  widgets: Partial<Record<WidgetId, WidgetState>>;
};

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Reminder {
  id: string;
  title: string;
  date: string;
  start: string;
  end?: string;
  color: string;
  repeat: ReminderRepeat;
  leadMinutes?: number;
}

export interface ReminderDraft extends Omit<Reminder, 'id'> {
  id?: string;
}

export interface SystemStats {
  cpu: number;
  memory: number;
  disk: number;
}

export interface WeatherSnapshot {
  city: string;
  temperature: number;
  apparent: number;
  high: number;
  low: number;
  code: number;
  isDay: boolean;
  units: WeatherUnits;
  updatedAt: number;
}

export interface WidgetContext {
  id: WidgetId;
  theme: ThemeSettings;
  resolvedTheme: ResolvedTheme;
  /** Effective lock: the global setting OR this widget's own toggle. */
  locked: boolean;
  weather: WeatherSettings;
  config: WidgetConfig;
}

export interface Appearance {
  theme: ThemeSettings;
  resolvedTheme: ResolvedTheme;
}

export interface CityResult {
  ok: boolean;
  name?: string;
  error?: string;
}

export interface SettingsSnapshot {
  settings: Settings;
  resolvedTheme: ResolvedTheme;
}

export interface SettingsPatch {
  theme?: Partial<ThemeSettings>;
  locked?: boolean;
  autostart?: boolean;
  keepDockIcon?: boolean;
  weather?: Partial<WeatherSettings>;
  dock?: Partial<DockSettings>;
  clipboardPanel?: Partial<ClipboardPanelSettings>;
}

export interface WidgetUpdate {
  id: WidgetId;
  config?: Partial<WidgetConfig>;
  size?: { width: number; height: number };
}

export interface WidgetUpdateResult {
  ok: boolean;
  error?: string;
  snapshot: SettingsSnapshot;
}

/** The API exposed to every renderer through the preload bridge. */
export interface WidgetApi {
  getContext(): Promise<WidgetContext>;
  onSettings(callback: (context: WidgetContext) => void): () => void;
  onResume(callback: (at: number) => void): () => void;
  onStats(callback: (stats: SystemStats) => void): () => void;
  getStats(): Promise<SystemStats>;
  onWeather(callback: (snapshot: WeatherSnapshot | null) => void): () => void;
  getReminders(): Promise<Reminder[]>;
  onReminders(callback: (reminders: Reminder[]) => void): () => void;
  saveReminder(draft: ReminderDraft): Promise<Reminder[]>;
  deleteReminder(id: string): Promise<Reminder[]>;
  openReminderEditor(): Promise<void>;
  getWeather(): Promise<WeatherSnapshot | null>;
  setWeatherCity(city: string): Promise<CityResult>;
  openCityEditor(): Promise<void>;
  getAppearance(): Promise<Appearance>;
  setTheme(theme: Partial<ThemeSettings>): Promise<void>;
  startDrag(screenX: number, screenY: number): void;
  dragTo(screenX: number, screenY: number): void;
  endDrag(): void;
  startResize(edge: ResizeEdge, screenX: number, screenY: number): void;
  resizeTo(screenX: number, screenY: number): void;
  endResize(): void;

  getSettings(): Promise<SettingsSnapshot>;
  setSettings(patch: SettingsPatch): Promise<SettingsSnapshot>;
  onSettingsSnapshot(callback: (snapshot: SettingsSnapshot) => void): () => void;
  toggleWidget(id: WidgetId, enabled: boolean): Promise<SettingsSnapshot>;
  updateWidget(update: WidgetUpdate): Promise<WidgetUpdateResult>;
  resetWidgets(id?: WidgetId): Promise<SettingsSnapshot>;
  reloadWidgets(): Promise<void>;
  captureWidget(id: WidgetId): Promise<string | null>;
  openSettings(): Promise<void>;
  quitApp(): Promise<void>;

  getDockStatus(): Promise<DockStatus>;
  onDockWindows(callback: (snapshot: DockSnapshot) => void): () => void;
  onDockPreview(callback: (payload: DockPreviewPayload) => void): () => void;
  onDockPreviewClosed(callback: () => void): () => void;
  hoverStart(appKey: string, iconRect: DockRect): void;
  hoverEnd(appKey: string): void;
  previewEnter(appKey: string): void;
  previewLeave(appKey: string): void;
  previewReady(): void;
  focusWindow(windowId: number): void;
  closeWindow(windowId: number): void;
  closeAll(appKey: string): void;
  launchApp(appKey: string, newWindow?: boolean): void;
  openDockMenu(appKey: string, x: number, y: number): void;
  setPinned(appKey: string, pinned: boolean): Promise<void>;
  refreshDock(): void;
  revealDock(): void;
  stopPlank(): Promise<void>;
  restartPlank(): Promise<void>;
  reportDockSize(width: number, height: number): void;

  toggleClipboardPanel(): Promise<void>;
  hideClipboardPanel(): void;
  onClipboardPanelShown(callback: () => void): () => void;
  getClipboardPanelStatus(): Promise<ClipboardPanelStatus>;
  getClipboardHistory(): Promise<ClipboardHistoryItem[]>;
  onClipboardHistory(callback: (items: ClipboardHistoryItem[]) => void): () => void;
  deleteClipboardItem(id: string): Promise<ClipboardHistoryItem[]>;
  clearClipboardHistory(): Promise<ClipboardHistoryItem[]>;
  pinClipboardItem(id: string, pinned: boolean): Promise<ClipboardHistoryItem[]>;
  useClipboardPanelItem(request: PanelUseRequest): Promise<void>;
  getPanelRecents(): Promise<PanelRecentItem[]>;
  onPanelRecents(callback: (items: PanelRecentItem[]) => void): () => void;
  searchTenor(query: string): Promise<TenorSearchResult>;
}
