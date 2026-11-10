import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sessionIsX11 } from '../x11.js';

const run = promisify(execFile);

export type PasteTool = 'xdotool' | 'wtype' | 'ydotool' | null;

let cached: PasteTool | undefined;

async function commandExists(name: string): Promise<boolean> {
  try {
    await run('sh', ['-c', `command -v ${name}`], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function detectPasteTool(force = false): Promise<PasteTool> {
  if (!force && cached !== undefined) return cached;

  if (sessionIsX11()) {
    if (await commandExists('xdotool')) cached = 'xdotool';
    else if (await commandExists('ydotool')) cached = 'ydotool';
    else cached = null;
  } else if (await commandExists('wtype')) {
    cached = 'wtype';
  } else if (await commandExists('ydotool')) {
    cached = 'ydotool';
  } else {
    cached = null;
  }

  return cached;
}

export function pasteTool(): PasteTool {
  return cached ?? null;
}

/** Sends Ctrl+V with the detected tool. Never throws; returns false on failure. */
export async function pasteInto(tool: PasteTool): Promise<boolean> {
  if (!tool) return false;

  try {
    if (tool === 'xdotool') {
      await run('xdotool', ['key', '--clearmodifiers', 'ctrl+v'], { timeout: 2000 });
    } else if (tool === 'wtype') {
      await run('wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl'], { timeout: 2000 });
    } else {
      // left ctrl (29) + v (47): press both, release both.
      await run('ydotool', ['key', '29:1', '47:1', '47:0', '29:0'], { timeout: 2000 });
    }
    return true;
  } catch (error) {
    console.warn(`[clipboard-panel] ${tool} paste failed:`, error);
    return false;
  }
}
