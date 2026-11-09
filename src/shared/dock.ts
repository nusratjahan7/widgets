export const DOCK_POSITIONS = ['bottom', 'left', 'right'] as const;

export type DockPosition = (typeof DOCK_POSITIONS)[number];

export const DOCK_EDGE_GAP = 6;

/** Screen-space rectangle, used for the hovered icon's hit area. */
export interface DockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One managed X11 top-level window. */
export interface DockWindow {
  /** Normalized decimal X11 window id. */
  id: number;
  title: string;
  /** WM_CLASS as reported by `wmctrl -lxp` (`instance.Class`); the grouping key. */
  wmClass: string;
  pid: number;
  /** -1 when sticky to every workspace. */
  desktop: number;
  minimized: boolean;
  focused: boolean;
}

export interface DockApp {
  /** Stable identity: the desktop-entry id when pinned, else the lowercase WM_CLASS. */
  key: string;
  name: string;
  /** Data URL, or '' when nothing could be resolved. */
  icon: string;
  pinned: boolean;
  windows: DockWindow[];
  launching: boolean;
}

export interface DockSnapshot {
  apps: DockApp[];
  /** App key that owns the focused window, if any. */
  focusedKey: string | null;
  x11: boolean;
  revision: number;
}

export interface DockPreviewWindow {
  id: number;
  title: string;
  /** Data URL of the captured frame, or null when it could not be captured. */
  thumbnail: string | null;
  minimized: boolean;
  focused: boolean;
}

export interface DockPreviewPayload {
  appKey: string;
  appName: string;
  appIcon: string;
  windows: DockPreviewWindow[];
  showClose: boolean;
  thumbWidth: number;
  thumbHeight: number;
  x11: boolean;
}

export interface DockPinnedApp {
  key: string;
  name: string;
  /** Icon path on disk; the main process converts it to a data URL per snapshot. */
  icon: string;
  desktopFile: string;
  /** WM_CLASS the app's windows report, when known from the desktop entry. */
  wmClass: string;
}

export interface DockSettings {
  enabled: boolean;
  /** Base icon size in px. */
  iconSize: number;
  /** Hover magnification factor. */
  zoom: number;
  position: DockPosition;
  autoHide: boolean;
  previews: boolean;
  /** Delay before a hovered icon opens its preview, in ms. */
  hoverDelay: number;
  /** Preview thumbnail width in px. */
  thumbScale: number;
  showClose: boolean;
  replacePlank: boolean;
  /** False until the pinned list has been seeded from a previous dock. */
  pinnedSeeded: boolean;
  pinned: DockPinnedApp[];
}

export interface DockStatus {
  x11: boolean;
  /** Whether `_NET_WM_STRUT_PARTIAL` could be written. */
  strut: boolean;
  session: string;
}

export const DOCK_DEFAULTS: DockSettings = {
  enabled: true,
  iconSize: 48,
  zoom: 1.6,
  position: 'bottom',
  autoHide: false,
  previews: true,
  hoverDelay: 300,
  thumbScale: 200,
  showClose: true,
  replacePlank: true,
  pinnedSeeded: false,
  pinned: [],
};

export const DOCK_LIMITS = {
  iconSize: { min: 32, max: 80 },
  zoom: { min: 1, max: 2 },
  hoverDelay: { min: 100, max: 1000 },
  thumbScale: { min: 120, max: 280 },
} as const;

/** Height/width of a preview tile for a given thumbnail width (5:3 crop). */
export function thumbHeightFor(thumbWidth: number): number {
  return Math.round((thumbWidth * 3) / 5);
}
