import { app } from 'electron';
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Electron has no API for `_NET_WM_STRUT_PARTIAL`, and `xprop -set` only writes a
 * single value (the property is an array of 12 CARDINALs). This tiny stdlib-only
 * helper writes it directly through libX11 with ctypes.
 *
 * It is embedded as a string rather than shipped as a file so electron-builder's
 * `files` list needs no extraResources entry.
 */
const STRUT_SCRIPT = `import ctypes, ctypes.util, sys

try:
    x11 = ctypes.CDLL(ctypes.util.find_library("X11"))
except OSError:
    sys.exit(3)

x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XInternAtom.restype = ctypes.c_ulong
x11.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
x11.XChangeProperty.argtypes = [
    ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong,
    ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int,
]
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]

display = x11.XOpenDisplay(None)
if not display:
    sys.exit(4)

window = int(sys.argv[1], 0)
values = [int(item) for item in sys.argv[2:14]]
if len(values) != 12:
    sys.exit(5)

# XA_CARDINAL = 6, PropModeReplace = 0, 32-bit items.
array = (ctypes.c_ulong * 12)(*values)
atom = x11.XInternAtom(display, b"_NET_WM_STRUT_PARTIAL", False)
x11.XChangeProperty(display, window, atom, 6, 32, 0, array, 12)
x11.XFlush(display)
x11.XCloseDisplay(display)
`;

let scriptPath: string | null = null;
let pythonAvailable: boolean | null = null;
/* Latched after the first real failure so we stop spawning python on every show. */
let strutDisabled = false;

function ensureScript(): string {
  if (scriptPath) return scriptPath;
  const target = path.join(app.getPath('temp'), 'desktop-widgets-strut.py');
  writeFileSync(target, STRUT_SCRIPT, 'utf8');
  scriptPath = target;
  return target;
}

async function hasPython(): Promise<boolean> {
  if (pythonAvailable !== null) return pythonAvailable;
  try {
    await run('python3', ['--version'], { timeout: 2000 });
    pythonAvailable = true;
  } catch {
    pythonAvailable = false;
    strutDisabled = true;
    console.warn('[dock] python3 not found — dock will float instead of reserving space');
  }
  return pythonAvailable;
}

export interface StrutSpec {
  /** X11 window id of the dock. */
  id: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
  topStart: number;
  topEnd: number;
  bottomStart: number;
  bottomEnd: number;
}

/** Writes the strut; returns false when the environment cannot do it. */
export async function applyStrut(spec: StrutSpec): Promise<boolean> {
  if (strutDisabled) return false;
  if (!(await hasPython())) return false;

  const values = [
    spec.left,
    spec.right,
    spec.top,
    spec.bottom,
    spec.leftStart,
    spec.leftEnd,
    spec.rightStart,
    spec.rightEnd,
    spec.topStart,
    spec.topEnd,
    spec.bottomStart,
    spec.bottomEnd,
  ].map((value) => Math.max(0, Math.round(value)));

  try {
    await run('python3', [ensureScript(), String(spec.id), ...values.map(String)], { timeout: 3000 });
    return true;
  } catch (error) {
    strutDisabled = true;
    console.warn('[dock] could not set _NET_WM_STRUT_PARTIAL — dock will float:', error);
    return false;
  }
}

/** Clears the strut so the reserved space is given back (used when hiding). */
export async function clearStrut(id: number): Promise<void> {
  if (strutDisabled) return;
  await applyStrut({
    id,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    leftStart: 0,
    leftEnd: 0,
    rightStart: 0,
    rightEnd: 0,
    topStart: 0,
    topEnd: 0,
    bottomStart: 0,
    bottomEnd: 0,
  });
}

export function strutAvailable(): boolean {
  return !strutDisabled && pythonAvailable !== false;
}

export function resetStrutState(): void {
  strutDisabled = false;
  pythonAvailable = null;
}
