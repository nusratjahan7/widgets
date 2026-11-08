import { app, Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeMode } from '../shared/types.js';
import { WIDGETS, WIDGET_IDS } from '../shared/widgets.js';
import { applyAutostart } from './autolaunch.js';
import { getSettings, store } from './settings.js';
import { openSettings } from './settingsWindow.js';
import { ACCENTS, ACCENT_NAMES, setAccent, setThemeMode } from './theme.js';
import * as wm from './windowManager.js';

const TRAY_ICON = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'tray.png');

const THEME_MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'Follow system' },
];

let tray: Tray | null = null;

function buildMenu(): Menu {
  const settings = getSettings();

  const widgetItems: MenuItemConstructorOptions[] = WIDGET_IDS.map((id) => ({
    label: WIDGETS[id].title,
    type: 'checkbox',
    checked: settings.widgets[id]?.visible !== false,
    click: () => {
      wm.setWidgetVisible(id, !wm.isWidgetVisible(id));
      refreshTray();
    },
  }));

  const themeItems: MenuItemConstructorOptions[] = THEME_MODES.map(({ mode, label }) => ({
    label,
    type: 'radio',
    checked: settings.theme.mode === mode,
    click: () => {
      setThemeMode(mode);
      refreshTray();
    },
  }));

  const accentItems: MenuItemConstructorOptions[] = ACCENTS.map((accent) => ({
    label: ACCENT_NAMES[accent] ?? accent,
    type: 'radio',
    checked: settings.theme.accent.toLowerCase() === accent,
    click: () => {
      setAccent(accent);
      refreshTray();
    },
  }));

  return Menu.buildFromTemplate([
    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { type: 'separator' },
    { label: 'Show / hide widgets', click: () => wm.toggleAll() },
    { type: 'separator' },
    { label: 'Widgets', submenu: widgetItems },
    {
      label: 'Lock position',
      type: 'checkbox',
      checked: settings.locked,
      click: () => {
        const locked = !getSettings().locked;
        store.set('locked', locked);
        wm.applyLocked(locked);
        refreshTray();
      },
    },
    { label: 'Theme', submenu: themeItems },
    { label: 'Accent', submenu: accentItems },
    { type: 'separator' },
    {
      label: 'Start at login',
      type: 'checkbox',
      checked: settings.autostart,
      click: () => {
        const autostart = !getSettings().autostart;
        store.set('autostart', autostart);
        applyAutostart(autostart);
        refreshTray();
      },
    },
    { label: 'Reload widgets', click: () => wm.reloadAll() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

export function createTray(): void {
  if (tray) return;

  const image = nativeImage.createFromPath(TRAY_ICON).resize({ width: 24, height: 24 });
  tray = new Tray(image);
  tray.setToolTip('Desktop Widgets');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => wm.toggleAll());
}

export function refreshTray(): void {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
