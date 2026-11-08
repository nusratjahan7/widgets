import { BrowserWindow, screen } from 'electron';
import { openSettings } from './settingsWindow.js';

let placeholder: BrowserWindow | null = null;

function create(): void {
  if (placeholder && !placeholder.isDestroyed()) return;

  const area = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: 1,
    height: 1,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    show: false,
  });

  win.setTitle('Desktop Widgets');
  win.on('page-title-updated', (event) => event.preventDefault());

  win.once('ready-to-show', () => {
    win.setOpacity(0);
    win.showInactive();
    win.minimize();
  });

  win.on('restore', () => {
    openSettings();
    if (!win.isDestroyed()) win.minimize();
  });

  win.on('closed', () => {
    placeholder = null;
  });

  void win.loadURL('data:text/html,<!doctype html><title>Desktop Widgets</title><body></body>');
  placeholder = win;
}

function destroy(): void {
  if (placeholder && !placeholder.isDestroyed()) placeholder.destroy();
  placeholder = null;
}

export function applyDockIcon(enabled: boolean): void {
  if (process.platform !== 'linux') return;
  if (enabled) create();
  else destroy();
}

export function destroyDockIcon(): void {
  destroy();
}
