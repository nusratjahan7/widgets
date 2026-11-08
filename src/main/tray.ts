import { app, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { openSettings } from './settingsWindow.js';
import * as wm from './windowManager.js';

const TRAY_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'tray.png')
  : path.join(app.getAppPath(), 'assets', 'tray.png');

let tray: Tray | null = null;

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open Settings', click: openSettings },
    { label: 'Show / Hide widgets', click: () => wm.toggleAll() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

export function createTray(): void {
  if (tray) return;

  try {
    const image = nativeImage.createFromPath(TRAY_ICON);
    if (image.isEmpty()) throw new Error(`Tray icon not found at ${TRAY_ICON}`);

    const next = new Tray(image.resize({ width: 24, height: 24 }));
    next.setToolTip('Desktop Widgets — click to open Settings');
    next.setContextMenu(buildMenu());
    next.on('click', () => openSettings());
    tray = next;
  } catch (error) {
    tray = null;
    console.warn('[tray] unavailable; Settings stays reachable from the dock:', error);
  }
}

export function refreshTray(): void {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
