import type { ClipboardPanelController } from './controller.js';

let current: ClipboardPanelController | null = null;

export function setClipboardPanel(controller: ClipboardPanelController | null): void {
  current = controller;
}

export function getClipboardPanel(): ClipboardPanelController | null {
  return current;
}
