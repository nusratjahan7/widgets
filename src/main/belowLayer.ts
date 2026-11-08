import { execFile, execFileSync } from 'node:child_process';
import type { BrowserWindow } from 'electron';

/**
 * Cinnamon (and other WMs) make `_NET_WM_WINDOW_TYPE_DESKTOP` windows
 * input-transparent, so the widgets could not be dragged or clicked. Instead we
 * use ordinary windows pinned to the bottom of the stack with the EWMH
 * "below" hint. That is the same recipe conky uses for desktop widgets.
 *
 * Electron cannot set that hint itself, so it goes through wmctrl.
 */

let availability: boolean | null = null;
let warned = false;

export function belowLayerAvailable(): boolean {
  if (availability !== null) return availability;

  if (process.platform !== 'linux') {
    availability = false;
    return availability;
  }

  try {
    execFileSync('wmctrl', ['-m'], { stdio: 'ignore', timeout: 2000 });
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

function windowHandle(win: BrowserWindow): number | null {
  if (win.isDestroyed()) return null;
  const handle = win.getNativeWindowHandle();
  return handle.length >= 4 ? handle.readUInt32LE(0) : null;
}

export function applyBelowLayer(win: BrowserWindow): void {
  if (process.platform !== 'linux') return;

  if (!belowLayerAvailable()) {
    if (!warned) {
      warned = true;
      console.warn('[widgets] wmctrl is missing: widgets stay on the desktop but cannot be clicked. Install it with `sudo apt install wmctrl`.');
    }
    return;
  }

  const xid = windowHandle(win);
  if (xid === null) return;

  const id = `0x${xid.toString(16)}`;
  execFile('wmctrl', ['-i', '-r', id, '-b', 'add,below'], { timeout: 3000 }, (error) => {
    if (error && !warned) {
      warned = true;
      console.warn('[widgets] could not apply the below layer:', error.message);
    }
  });

  // Re-mapping a sticky window sets the urgency hint on some WMs; passive
  // widgets should never ask for attention.
  execFile('wmctrl', ['-i', '-r', id, '-b', 'remove,demands_attention'], () => {});
}
