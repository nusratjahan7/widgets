import { execFile } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const AUTOSTART_DIR = path.join(homedir(), '.config', 'autostart');
const PLANK_ENTRY = path.join(AUTOSTART_DIR, 'plank.desktop');
const PLANK_DISABLED = path.join(AUTOSTART_DIR, 'plank.desktop.disabled-by-dock');

/**
 * Reversible Plank autostart toggle.
 *
 * The entry is renamed, never deleted, so the user can always get their previous
 * dock back with a single `mv`.
 */
export function setPlankEnabled(enabled: boolean): boolean {
  try {
    if (!enabled) {
      if (!existsSync(PLANK_ENTRY)) return false;
      renameSync(PLANK_ENTRY, PLANK_DISABLED);
      return true;
    }

    if (existsSync(PLANK_DISABLED)) {
      renameSync(PLANK_DISABLED, PLANK_ENTRY);
      return true;
    }
  } catch (error) {
    console.warn('[dock] could not toggle the Plank autostart entry:', error);
  }
  return false;
}

export function plankAutostartState(): 'enabled' | 'disabled' | 'missing' {
  if (existsSync(PLANK_ENTRY)) return 'enabled';
  if (existsSync(PLANK_DISABLED)) return 'disabled';
  return 'missing';
}

/** Stops a running Plank. Only called from an explicit Settings action. */
export async function stopPlank(): Promise<void> {
  try {
    await run('pkill', ['-x', 'plank'], { timeout: 3000 });
  } catch {
    // Already stopped, or pkill found nothing — both are fine.
  }
}

/** Starts Plank again, for users who decide they want the old dock back. */
export async function startPlank(): Promise<void> {
  try {
    await run('/bin/sh', ['-c', 'setsid plank >/dev/null 2>&1 &'], { timeout: 3000 });
  } catch (error) {
    console.warn('[dock] could not start Plank:', error);
  }
}
