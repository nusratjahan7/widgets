import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DockWindow } from '../shared/dock.js';

const run = promisify(execFile);

const TIMEOUT = 2000;

/**
 * `wmctrl`/`xprop` are used instead of xdotool (not installed here) or a native X11
 * binding: they ship with Mint, need no build step, and `wmctrl -lxp` already returns
 * the pid + WM_CLASS + title we need to group windows.
 */
export function sessionIsX11(): boolean {
  if (process.platform !== 'linux') return false;
  const session = (process.env.XDG_SESSION_TYPE ?? '').toLowerCase();
  if (session === 'wayland') return false;
  if (session === 'x11') return true;
  return Boolean(process.env.DISPLAY) && !process.env.WAYLAND_DISPLAY;
}

async function capture(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run(command, args, { timeout: TIMEOUT, maxBuffer: 4 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

/** Parses `0x03200003` / `1234` into a number, or null when it is not a window id. */
function parseWindowId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = trimmed.toLowerCase().startsWith('0x') ? Number.parseInt(trimmed, 16) : Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Lists managed top-level windows.
 *
 * `wmctrl -lxp` columns: id, desktop, pid, WM_CLASS, host, title.
 * Desktop `-1` means sticky. Returns [] when the WM does not answer.
 */
export async function listWindows(): Promise<Omit<DockWindow, 'minimized' | 'focused'>[]> {
  const stdout = await capture('wmctrl', ['-lxp']);
  if (!stdout) return [];

  const windows: Omit<DockWindow, 'minimized' | 'focused'>[] = [];

  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;

    const fields = line.trim().split(/\s+/);
    if (fields.length < 5) continue;

    const id = parseWindowId(fields[0]);
    if (id === null) continue;

    const desktop = Number.parseInt(fields[1], 10);
    const pid = Number.parseInt(fields[2], 10);
    const wmClass = fields[3];
    // Everything after the host column is the title, which may contain spaces.
    const title = fields.slice(5).join(' ');

    windows.push({
      id,
      desktop: Number.isFinite(desktop) ? desktop : -1,
      pid: Number.isFinite(pid) ? pid : -1,
      wmClass,
      title: title || wmClass.split('.').at(-1) || 'Untitled window',
    });
  }

  return windows;
}

/** The window id reported by `_NET_ACTIVE_WINDOW`, or null. */
export async function activeWindow(): Promise<number | null> {
  const stdout = await capture('xprop', ['-root', '_NET_ACTIVE_WINDOW']);
  if (!stdout) return null;
  const match = stdout.match(/#\s*(0x[0-9a-fA-F]+|\d+)/);
  if (!match) return null;
  const id = parseWindowId(match[1]);
  // 0 means "no active window".
  return id && id !== 0 ? id : null;
}

/** True when the window is iconified (`_NET_WM_STATE_HIDDEN`). */
export async function isMinimized(id: number): Promise<boolean> {
  const stdout = await capture('xprop', ['-id', String(id), '_NET_WM_STATE']);
  if (!stdout) return false;
  return stdout.includes('_NET_WM_STATE_HIDDEN');
}

/**
 * True for docks/panels and desktop windows, which are not applications and must not
 * appear as dock icons or preview tiles (Plank, Nemo's desktop window, panels).
 */
export async function isDockOrDesktop(id: number): Promise<boolean> {
  const stdout = await capture('xprop', ['-id', String(id), '_NET_WM_WINDOW_TYPE']);
  if (!stdout) return false;
  return (
    stdout.includes('_NET_WM_WINDOW_TYPE_DOCK') || stdout.includes('_NET_WM_WINDOW_TYPE_DESKTOP')
  );
}

/** Minimize state for several windows in parallel. */
export async function minimizedStates(ids: number[]): Promise<Map<number, boolean>> {
  const states = new Map<number, boolean>();
  await Promise.all(
    ids.map(async (id) => {
      states.set(id, await isMinimized(id));
    }),
  );
  return states;
}

/** Activates a window: raises it, switches workspaces, and un-minimizes on Muffin. */
export async function focusWindow(id: number): Promise<boolean> {
  const stdout = await capture('wmctrl', ['-ia', String(id)]);
  return stdout !== null;
}

/** Sends a graceful `_NET_CLOSE_WINDOW` request. */
export async function closeWindow(id: number): Promise<boolean> {
  const stdout = await capture('wmctrl', ['-i', '-c', String(id)]);
  return stdout !== null;
}

/** Whether `wmctrl` is usable at all; used to decide on the degraded path. */
export async function available(): Promise<boolean> {
  const stdout = await capture('wmctrl', ['-m']);
  return Boolean(stdout);
}
