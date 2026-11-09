import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const TIMEOUT = 2000;

/**
 * `wmctrl`/`xprop` are used instead of a native X11 binding: they ship with Mint and
 * need no build step. The clipboard panel uses them to restore focus before pasting.
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

/** Activates a window: raises it, switches workspaces, and un-minimizes on Muffin. */
export async function focusWindow(id: number): Promise<boolean> {
  const stdout = await capture('wmctrl', ['-ia', String(id)]);
  return stdout !== null;
}
