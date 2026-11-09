import { app, protocol } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MEDIA_SCHEME } from '../../shared/clipboard-panel/types.js';

const ID_PATTERN = /^[a-z0-9-]{8,64}$/;

let schemeRegistered = false;

/**
 * Must run before `app.whenReady()`. A standard, secure scheme lets the panel
 * render `<img src="clipboard-panel-media://media/<id>.png">` without exposing
 * the filesystem or turning on web security exceptions.
 */
export function registerPanelMediaScheme(): void {
  if (schemeRegistered) return;
  schemeRegistered = true;
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

export function mediaDir(): string {
  const dir = path.join(app.getPath('userData'), 'clipboard-panel-media');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function mediaPath(id: string): string | null {
  if (!ID_PATTERN.test(id)) return null;
  return path.join(mediaDir(), `${id}.png`);
}

export function writeMedia(id: string, png: Buffer): boolean {
  const file = mediaPath(id);
  if (!file) return false;
  try {
    writeFileSync(file, png);
    return true;
  } catch (error) {
    console.warn('[clipboard-panel] could not write image', error);
    return false;
  }
}

export function deleteMedia(id: string): void {
  const file = mediaPath(id);
  if (!file) return;
  try {
    rmSync(file, { force: true });
  } catch {
    // best effort
  }
}

export function mediaExists(id: string): boolean {
  const file = mediaPath(id);
  return Boolean(file && existsSync(file));
}

/** Removes PNG files no longer referenced by the stored history. */
export function pruneOrphans(referenced: Set<string>): void {
  try {
    for (const entry of readdirSync(mediaDir())) {
      const id = entry.replace(/\.png$/, '');
      if (!entry.endsWith('.png') || !ID_PATTERN.test(id)) continue;
      if (!referenced.has(id)) deleteMedia(id);
    }
  } catch {
    // best effort
  }
}

/** Serves image files to the panel renderer. Call after `app.whenReady()`. */
export function servePanelMedia(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url);
    const id = path.basename(url.pathname, '.png');
    const file = mediaPath(id);
    if (!file || !existsSync(file)) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const data = readFileSync(file);
      return new Response(data, { headers: { 'content-type': 'image/png' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
