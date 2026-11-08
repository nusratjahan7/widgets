import { BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';

const SETTINGS_PATH = path.join(RENDERER_DIR, 'settings.html');

let settingsWindow: BrowserWindow | null = null;

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}

export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 880,
    height: 620,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#131418' : '#eef0f4',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  settingsWindow.setTitle('Desktop Widgets Settings');
  settingsWindow.on('page-title-updated', (event) => event.preventDefault());

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  if (DEV_SERVER_URL) void settingsWindow.loadURL(`${DEV_SERVER_URL}/settings.html`);
  else void settingsWindow.loadFile(SETTINGS_PATH);
}
