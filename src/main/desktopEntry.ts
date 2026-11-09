import { app } from 'electron';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DockPinnedApp } from '../shared/dock.js';

const run = promisify(execFile);

const DATA_DIRS = [
  '/usr/share/applications',
  '/usr/local/share/applications',
  '/var/lib/flatpak/exports/share/applications',
  path.join(homedir(), '.local', 'share', 'applications'),
  path.join(homedir(), '.local', 'share', 'flatpak', 'exports', 'share', 'applications'),
];

const ICON_DIRS = [
  path.join(homedir(), '.local', 'share', 'icons'),
  path.join(homedir(), '.icons'),
  '/usr/share/icons',
  '/usr/local/share/icons',
  '/usr/share/pixmaps',
];

const ICON_SIZES = [256, 128, 96, 64, 48, 32, 24, 16];
const ICON_SUFFIXES = ['', '@2x', '@2', '-symbolic'];

export interface DesktopApp {
  /** Desktop-entry file name without `.desktop`, e.g. `google-chrome`. */
  id: string;
  file: string;
  name: string;
  exec: string;
  icon: string;
  terminal: boolean;
  /** `StartupWMClass`, verbatim. */
  startupWmClass: string;
  /** Action `Exec` values keyed by action id (`new-window` → command). */
  actions: Record<string, string>;
}

interface Entry {
  desktopId: string;
  file: string;
  name: string;
  exec: string;
  icon: string;
  terminal: boolean;
  startupWmClass: string;
  noDisplay: boolean;
  actions: string[];
  actionNames: Record<string, string>;
  actionExecs: Record<string, string>;
}

function unescapeValue(value: string): string {
  return value.replace(/\\([snt\\])/g, (_match, code: string) => {
    if (code === 's') return ' ';
    if (code === 'n') return '\n';
    if (code === 't') return '\t';
    return '\\';
  });
}

/** Minimal `.desktop` parser: `[Group]` sections, `Key=value`, first group wins. */
function parseDesktopFile(file: string, desktopId: string): Entry | null {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const values: Record<string, Record<string, string>> = {};
  let group = '';
  let inAction = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      group = line.slice(1, -1);
      inAction = group.startsWith('Desktop Action ');
      if (group === 'Desktop Entry') inAction = false;
      continue;
    }

    if (inAction) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    // Ignore localized keys (`Name[de]`): only the default value is used.
    if (key.includes('[')) continue;

    const bucket = (values[group] ??= {});
    if (!(key in bucket)) bucket[key] = unescapeValue(line.slice(eq + 1).trim());
  }

  const entry = values['Desktop Entry'];
  if (!entry) return null;

  const actionNames: Record<string, string> = {};
  const actionExecs: Record<string, string> = {};
  for (const [name, bucket] of Object.entries(values)) {
    if (!name.startsWith('Desktop Action ')) continue;
    const actionId = name.slice('Desktop Action '.length);
    if (bucket.Name) actionNames[actionId] = bucket.Name;
    if (bucket.Exec) actionExecs[actionId] = bucket.Exec;
  }

  const name = entry.Name?.trim();
  const exec = entry.Exec?.trim();
  if (!name || !exec) return null;

  return {
    desktopId,
    file,
    name,
    exec,
    icon: entry.Icon?.trim() ?? '',
    terminal: entry.Terminal === 'true',
    startupWmClass: entry.StartupWMClass?.trim() ?? '',
    noDisplay: entry.NoDisplay === 'true',
    actions: (entry.Actions ?? '').split(';').map((item) => item.trim()).filter(Boolean),
    actionNames,
    actionExecs,
  };
}

let index: Map<string, Entry> | null = null;

/** All launchable desktop entries, keyed by desktop id. Parsed once, then cached. */
export function desktopEntries(): Map<string, Entry> {
  if (index) return index;

  const entries = new Map<string, Entry>();
  for (const dir of DATA_DIRS) {
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.desktop')) continue;
      // Later directories win, so user-local entries override system ones.
      const desktopId = file.slice(0, -'.desktop'.length);
      const parsed = parseDesktopFile(path.join(dir, file), desktopId);
      if (parsed) entries.set(desktopId, parsed);
    }
  }

  index = entries;
  return entries;
}

export function invalidateDesktopEntries(): void {
  index = null;
}

export function findEntry(desktopId: string): Entry | undefined {
  return desktopEntries().get(desktopId);
}

/**
 * `wmctrl` reports WM_CLASS as `instance.Class`, so a single string such as
 * `google-chrome.Google-chrome` must be reduced to the part a desktop entry names.
 * Every plausible part is returned (full value, instance, class) because the split
 * point is ambiguous for dotted classes like `org.gnome.Nautilus`.
 */
function wmClassCandidates(wmClass: string): string[] {
  const raw = wmClass.trim().toLowerCase();
  if (!raw) return [];

  const candidates = new Set<string>([raw]);
  const firstDot = raw.indexOf('.');
  if (firstDot > 0) {
    candidates.add(raw.slice(0, firstDot));
    candidates.add(raw.slice(firstDot + 1));
  }
  const lastDot = raw.lastIndexOf('.');
  if (lastDot > 0) candidates.add(raw.slice(lastDot + 1));

  return [...candidates];
}

/**
 * Resolves the desktop id that owns a WM_CLASS.
 *
 * Matching is case-insensitive against `StartupWMClass`, then against the id itself,
 * then against the executable basename, trying both the instance and class halves of
 * `instance.Class`. Apps commonly report a different case than their entry
 * (`google-chrome` entry vs `Google-chrome` class), so exact matching is not enough.
 */
export function desktopIdForWmClass(wmClass: string): string | null {
  const candidates = wmClassCandidates(wmClass);
  if (candidates.length === 0) return null;

  const matches = (value: string | undefined): boolean =>
    Boolean(value) && candidates.includes(value!.toLowerCase());

  for (const entry of desktopEntries().values()) {
    if (entry.noDisplay) continue;
    if (matches(entry.startupWmClass)) return entry.desktopId;
  }

  for (const entry of desktopEntries().values()) {
    if (entry.noDisplay) continue;
    if (candidates.includes(entry.desktopId.toLowerCase())) return entry.desktopId;
  }

  for (const entry of desktopEntries().values()) {
    if (entry.noDisplay) continue;
    if (matches(executableName(entry.exec))) return entry.desktopId;
  }

  return null;
}

/** First token of `Exec`, with paths stripped: `env X=1 /usr/bin/code %F` → `code`. */
function executableName(exec: string): string {
  const tokens = exec.split(/\s+/).filter(Boolean);
  const binary = tokens.find((token) => !token.includes('=')) ?? '';
  return path.basename(binary);
}

/** Reworked icon lookup: returns a file path for an icon name or absolute path. */
export function resolveIconPath(icon: string): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;

  if (path.isAbsolute(trimmed)) return existsSync(trimmed) ? trimmed : null;

  const hasExtension = /\.(png|svg|xpm|jpg|jpeg)$/i.test(trimmed);
  const baseName = hasExtension ? trimmed.replace(/\.(png|svg|xpm|jpg|jpeg)$/i, '') : trimmed;
  const extensions = hasExtension ? [path.extname(trimmed)] : ['.png', '.svg', '.xpm'];

  for (const root of ICON_DIRS) {
    if (root.endsWith('pixmaps')) {
      for (const ext of extensions) {
        const candidate = path.join(root, `${baseName}${ext}`);
        if (existsSync(candidate)) return candidate;
      }
      continue;
    }

    for (const size of ICON_SIZES) {
      for (const suffix of ICON_SUFFIXES) {
        for (const ext of extensions) {
          for (const category of ['apps', 'applications', 'places']) {
            const candidate = path.join(root, 'hicolor', `${size}x${size}${suffix}`, category, `${baseName}${ext}`);
            if (existsSync(candidate)) return candidate;
          }
        }
      }
    }

    // Theme-specific directories (WhiteSur, Mint-L, Papirus, …) before plain hicolor.
    let themes: string[];
    try {
      themes = readdirSync(root);
    } catch {
      continue;
    }

    for (const theme of themes) {
      if (theme === 'hicolor') continue;
      for (const size of ICON_SIZES) {
        for (const suffix of ICON_SUFFIXES) {
          for (const ext of extensions) {
            for (const category of ['apps', 'applications', 'places']) {
              const candidate = path.join(root, theme, `${size}x${size}${suffix}`, category, `${baseName}${ext}`);
              if (existsSync(candidate)) return candidate;
            }
          }
        }
      }
    }

    // Scalable variants last: they are the most expensive to rasterize.
    for (const theme of themes) {
      for (const category of ['apps', 'applications', 'places']) {
        for (const ext of extensions) {
          const candidate = path.join(root, theme, 'scalable', category, `${baseName}${ext}`);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  }

  return null;
}

/** Launches an app through gtk-launch, which handles DBus activation correctly. */
export async function launchDesktopId(desktopId: string): Promise<boolean> {
  const entry = findEntry(desktopId);
  if (!entry) return false;

  try {
    await run('gtk-launch', [desktopId], { timeout: 5000 });
    return true;
  } catch {
    // gtk-launch fails when the entry lives outside the standard dirs; run Exec directly.
    try {
      const command = entry.exec.replace(/%[fFuUdDnNickvm]/g, '').trim();
      if (!command) return false;
      await run('/bin/sh', ['-c', `setsid ${command} >/dev/null 2>&1 &`], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/** Opens a new window, preferring a `new-window`-style desktop action. */
export async function launchNewWindow(desktopId: string): Promise<boolean> {
  const entry = findEntry(desktopId);
  if (!entry) return false;

  const preferred = ['new-window', 'new-empty-window', 'new-window-simple', 'open-home', 'newwindow'];
  const actionId =
    preferred.find((id) => entry.actionExecs[id]) ?? entry.actions.find((id) => /new|window/i.test(id));

  if (actionId && entry.actionExecs[actionId]) {
    const command = entry.actionExecs[actionId].replace(/%[fFuUdDnNickvm]/g, '').trim();
    if (command) {
      try {
        await run('/bin/sh', ['-c', `setsid ${command} >/dev/null 2>&1 &`], { timeout: 5000 });
        return true;
      } catch {
        // Fall through to a plain launch.
      }
    }
  }

  return launchDesktopId(desktopId);
}

/**
 * Reads the pinned apps from an existing Plank dock so a replacement dock starts
 * with the same icons instead of an empty bar.
 */
export function readPlankLaunchers(): DockPinnedApp[] {
  const launchersDir = path.join(homedir(), '.config', 'plank', 'dock1', 'launchers');
  let files: string[];
  try {
    files = readdirSync(launchersDir).filter((file) => file.endsWith('.dockitem'));
  } catch {
    return [];
  }

  const pinned: DockPinnedApp[] = [];
  const seen = new Set<string>();

  for (const file of files.sort()) {
    let text: string;
    try {
      text = readFileSync(path.join(launchersDir, file), 'utf8');
    } catch {
      continue;
    }

    const match = text.match(/^\s*Launcher\s*=\s*(.+)$/m);
    if (!match) continue;

    const target = match[1].trim().replace(/^file:\/\//, '');
    const desktopFile = decodeURIComponent(target);
    const desktopId = path.basename(desktopFile).replace(/\.desktop$/, '');
    if (seen.has(desktopId)) continue;

    const entry = findEntry(desktopId);
    if (!entry) continue;

    seen.add(desktopId);
    pinned.push({
      key: desktopId,
      name: entry.name,
      icon: entry.icon,
      desktopFile: entry.file,
      wmClass: entry.startupWmClass,
    });
  }

  return pinned;
}

/** Convenience for the Settings/seed path: a pinned app record from a desktop id. */
export function pinnedFromDesktopId(desktopId: string): DockPinnedApp | null {
  const entry = findEntry(desktopId);
  if (!entry) return null;
  return {
    key: entry.desktopId,
    name: entry.name,
    icon: entry.icon,
    desktopFile: entry.file,
    wmClass: entry.startupWmClass,
  };
}

export function appNameFor(desktopId: string, fallback: string): string {
  return findEntry(desktopId)?.name ?? fallback;
}

export function appIconFor(desktopId: string, fallback: string): string {
  const entry = findEntry(desktopId);
  if (entry) return entry.icon;
  return fallback;
}

/** Used by the seeder to know whether Plank is even installed. */
export function plankConfigDir(): string {
  return path.join(homedir(), '.config', 'plank');
}

export function appRoot(): string {
  return app.getAppPath();
}
