import {
  DOCK_DEFAULTS,
  DOCK_LIMITS,
  DOCK_POSITIONS,
  type DockPinnedApp,
  type DockPosition,
  type DockSettings,
} from '../dock.js';
import { isRecord } from './values.js';
import type { ConfigField } from './types.js';

/**
 * Rendered by `Field.tsx` in Settings → Dock.
 *
 * Deliberately NOT passed through `defaultConfig()` from `values.ts`: that helper
 * injects a structural `size` key meant for widgets, which the dock does not have.
 */
export const dockConfig: ConfigField[] = [
  {
    key: 'enabled',
    label: 'Enable dock',
    description: 'Show the dock on screen. Turning it off removes the window and its reserved space.',
    type: 'toggle',
    default: DOCK_DEFAULTS.enabled,
  },
  {
    key: 'previews',
    label: 'Show window previews',
    description: 'Hover an icon to see a thumbnail card for each of its open windows.',
    type: 'toggle',
    default: DOCK_DEFAULTS.previews,
  },
  {
    key: 'iconSize',
    label: 'Icon size',
    type: 'number',
    default: DOCK_DEFAULTS.iconSize,
    min: DOCK_LIMITS.iconSize.min,
    max: DOCK_LIMITS.iconSize.max,
    unit: 'px',
  },
  {
    key: 'zoom',
    label: 'Hover zoom',
    description: 'How far icons grow as the pointer passes over them.',
    type: 'number',
    default: DOCK_DEFAULTS.zoom,
    min: DOCK_LIMITS.zoom.min,
    max: DOCK_LIMITS.zoom.max,
    step: 0.1,
  },
  {
    key: 'position',
    label: 'Position',
    type: 'select',
    default: DOCK_DEFAULTS.position,
    options: [
      { value: 'bottom', label: 'Bottom' },
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ],
  },
  {
    key: 'autoHide',
    label: 'Auto-hide',
    description: 'Slide the dock away and reveal it when the pointer reaches the screen edge.',
    type: 'toggle',
    default: DOCK_DEFAULTS.autoHide,
  },
  {
    key: 'hoverDelay',
    label: 'Hover delay',
    description: 'Wait this long before a preview appears.',
    type: 'number',
    default: DOCK_DEFAULTS.hoverDelay,
    min: DOCK_LIMITS.hoverDelay.min,
    max: DOCK_LIMITS.hoverDelay.max,
    step: 50,
    unit: 'ms',
  },
  {
    key: 'thumbScale',
    label: 'Thumbnail width',
    type: 'number',
    default: DOCK_DEFAULTS.thumbScale,
    min: DOCK_LIMITS.thumbScale.min,
    max: DOCK_LIMITS.thumbScale.max,
    unit: 'px',
  },
  {
    key: 'showClose',
    label: 'Show close button',
    description: 'Show a close button on each preview card.',
    type: 'toggle',
    default: DOCK_DEFAULTS.showClose,
  },
  {
    key: 'replacePlank',
    label: 'Replace Plank on login',
    description: 'Disable the Plank autostart entry so this dock is the only one at login.',
    type: 'toggle',
    default: DOCK_DEFAULTS.replacePlank,
  },
];

export function isDockPosition(value: unknown): value is DockPosition {
  return typeof value === 'string' && (DOCK_POSITIONS as readonly string[]).includes(value);
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric * 100) / 100));
}

function pin(value: unknown): DockPinnedApp | null {
  if (!isRecord(value)) return null;
  const key = typeof value.key === 'string' ? value.key.trim().slice(0, 120) : '';
  const desktopFile = typeof value.desktopFile === 'string' ? value.desktopFile.slice(0, 512) : '';
  if (!key) return null;

  return {
    key,
    desktopFile,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.slice(0, 120) : key,
    icon: typeof value.icon === 'string' ? value.icon.slice(0, 512) : '',
    wmClass: typeof value.wmClass === 'string' ? value.wmClass.slice(0, 120) : '',
  };
}

/** Clamps every field so a corrupt `settings.json` can never break dock startup. */
export function sanitizeDockSettings(raw: unknown): DockSettings {
  const source = isRecord(raw) ? raw : {};
  const pinnedRaw = Array.isArray(source.pinned) ? source.pinned : [];

  const seen = new Set<string>();
  const pinned: DockPinnedApp[] = [];
  for (const entry of pinnedRaw) {
    const app = pin(entry);
    if (!app || seen.has(app.key)) continue;
    seen.add(app.key);
    pinned.push(app);
  }

  return {
    enabled: source.enabled !== false,
    iconSize: clamp(source.iconSize, DOCK_LIMITS.iconSize.min, DOCK_LIMITS.iconSize.max, DOCK_DEFAULTS.iconSize),
    zoom: clamp(source.zoom, DOCK_LIMITS.zoom.min, DOCK_LIMITS.zoom.max, DOCK_DEFAULTS.zoom),
    position: isDockPosition(source.position) ? source.position : DOCK_DEFAULTS.position,
    autoHide: source.autoHide === true,
    previews: source.previews !== false,
    hoverDelay: clamp(
      source.hoverDelay,
      DOCK_LIMITS.hoverDelay.min,
      DOCK_LIMITS.hoverDelay.max,
      DOCK_DEFAULTS.hoverDelay,
    ),
    thumbScale: clamp(
      source.thumbScale,
      DOCK_LIMITS.thumbScale.min,
      DOCK_LIMITS.thumbScale.max,
      DOCK_DEFAULTS.thumbScale,
    ),
    showClose: source.showClose !== false,
    replacePlank: source.replacePlank !== false,
    pinnedSeeded: source.pinnedSeeded === true,
    pinned,
  };
}

/** Merges a partial patch onto current dock settings, keeping everything valid. */
export function mergeDockSettings(current: DockSettings, patch: unknown): DockSettings {
  if (!isRecord(patch)) return current;
  return sanitizeDockSettings({ ...current, ...patch, pinned: patch.pinned ?? current.pinned });
}
