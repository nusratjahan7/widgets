import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { DEV_SERVER_URL, PRELOAD_PATH, RENDERER_DIR } from './paths.js';
import { getWidgetConfig } from './settings.js';
import { getWidgetWindow } from './windowManager.js';

let editor: BrowserWindow | null = null;

export function openReminderEditor(): void {
  if (editor && !editor.isDestroyed()) {
    editor.show();
    editor.focus();
    return;
  }

  const widget = getWidgetWindow('reminder');
  const anchor = widget && !widget.isDestroyed() ? widget.getBounds() : null;
  const area = anchor ? screen.getDisplayMatching(anchor).workArea : screen.getPrimaryDisplay().workArea;

  const width = 380;
  const height = Math.min(540, area.height - 16);
  const x = anchor
    ? Math.min(Math.max(anchor.x, area.x + 8), area.x + area.width - width - 8)
    : area.x + area.width - width - 40;

  const below = anchor ? anchor.y + anchor.height + 10 : area.y + 60;
  const above = anchor ? anchor.y - height - 10 : area.y + 60;
  const preferred = anchor && below + height > area.y + area.height - 8 ? above : below;
  const y = Math.min(Math.max(preferred, area.y + 8), area.y + area.height - height - 8);

  const config = getWidgetConfig('reminder');
  const color = typeof config.defaultReminderColor === 'string' ? config.defaultReminderColor : '#34c759';
  const lead = typeof config.leadMinutes === 'number' ? config.leadMinutes : 0;
  const hour12 = config.hour12 === true ? '1' : '0';

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
    void editor.loadURL(
      `${DEV_SERVER_URL}/reminder.html?color=${encodeURIComponent(color)}&hour12=${hour12}&lead=${lead}`,
    );
  } else {
    void editor.loadFile(path.join(RENDERER_DIR, 'reminder.html'), {
      query: { color, hour12, lead: String(lead) },
    });
  }
}
