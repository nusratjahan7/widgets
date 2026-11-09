import type { BrowserWindow } from 'electron';

let target: BrowserWindow | null = null;

export function setPanelWindow(win: BrowserWindow | null): void {
  target = win;
}

export function getPanelWindow(): BrowserWindow | null {
  return target && !target.isDestroyed() ? target : null;
}

/** Pushes a message to the panel only; `windowManager.broadcast` covers widgets. */
export function sendToPanel(channel: string, payload?: unknown): void {
  const win = getPanelWindow();
  if (!win || win.webContents.isLoadingMainFrame()) return;
  if (payload === undefined) win.webContents.send(channel);
  else win.webContents.send(channel, payload);
}
