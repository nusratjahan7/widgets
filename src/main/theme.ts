import { nativeTheme } from 'electron';
import type { ThemeMode } from '../shared/types.js';
import { getSettings, store } from './settings.js';
import { broadcastContext, broadcastSnapshot } from './windowManager.js';

export { ACCENTS, ACCENT_NAMES } from '../shared/palette.js';

export function initTheme(): void {
  nativeTheme.themeSource = getSettings().theme.mode;
  nativeTheme.on('updated', () => {
    broadcastContext();
    broadcastSnapshot();
  });
}

export function setThemeMode(mode: ThemeMode): void {
  store.set('theme', { ...getSettings().theme, mode });
  nativeTheme.themeSource = mode;
  broadcastContext();
  broadcastSnapshot();
}

export function setAccent(accent: string): void {
  store.set('theme', { ...getSettings().theme, accent });
  broadcastContext();
  broadcastSnapshot();
}
