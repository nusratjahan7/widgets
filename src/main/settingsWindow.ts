import { BrowserWindow, nativeTheme } from 'electron';
import path from 'node:path';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';
import { isQuitting } from './appState.js';

const SETTINGS_PATH = path.join(RENDERER_DIR, 'settings.html');

let settingsWindow: BrowserWindow | null = null;
let requestShow = false;

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 880,
    height: 620,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#131418' : '#eef0f4',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  win.setTitle('Desktop Widgets Settings');
  win.on('page-title-updated', (event) => event.preventDefault());

  win.on('close', (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    win.hide();
  });

  win.on('closed', () => {
    settingsWindow = null;
  });

  win.once('ready-to-show', () => {
    if (!requestShow) return;
    requestShow = false;
    win.show();
    win.focus();
  });

  if (DEV_SERVER_URL) void win.loadURL(`${DEV_SERVER_URL}/settings.html`);
  else void win.loadFile(SETTINGS_PATH);

  return win;
}

function ensureWindow(): BrowserWindow {
  const existing = getSettingsWindow();
  if (existing) return existing;

  settingsWindow = createWindow();
  return settingsWindow;
}

export function openSettings(): void {
  const win = ensureWindow();
  requestShow = true;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
