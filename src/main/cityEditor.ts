import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';
import { getWidgetWindow } from './windowManager.js';

let editor: BrowserWindow | null = null;

/**
 * Desktop-layer windows can't take keyboard focus on Cinnamon (the WM refuses
 * to activate them), so the location field lives in this transient popover.
 */
export function openCityEditor(city: string): void {
  if (editor && !editor.isDestroyed()) {
    editor.focus();
    return;
  }

  const weather = getWidgetWindow('weather');
  const anchor = weather && !weather.isDestroyed() ? weather.getBounds() : null;
  const area = anchor
    ? screen.getDisplayMatching(anchor).workArea
    : screen.getPrimaryDisplay().workArea;

  const width = 340;
  const height = 136;
  const x = anchor
    ? Math.min(Math.max(anchor.x, area.x + 8), area.x + area.width - width - 8)
    : area.x + area.width - width - 40;
  const y = anchor
    ? Math.min(anchor.y + anchor.height + 10, area.y + area.height - height - 8)
    : area.y + 60;

  editor = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  editor.once('ready-to-show', () => {
    editor?.show();
    editor?.focus();
  });

  editor.on('closed', () => {
    editor = null;
  });

  if (DEV_SERVER_URL) {
    void editor.loadURL(`${DEV_SERVER_URL}/editor.html?city=${encodeURIComponent(city)}`);
  } else {
    void editor.loadFile(path.join(RENDERER_DIR, 'editor.html'), { query: { city } });
  }
}
