import type { ConfigField } from './types.js';
import { CLIPBOARD_PANEL_DEFAULTS } from './settings.js';

/**
 * Rendered by `Field.tsx` in Settings → Clipboard.
 *
 * Deliberately not passed through `defaultConfig()`: that helper injects a
 * structural `size` key meant for widgets.
 */
export const clipboardPanelConfig: ConfigField[] = [
  {
    key: 'enabled',
    label: 'Enable clipboard panel',
    description:
      'Open the panel with the --toggle command (bind it to Super+V in your desktop shortcuts).',
    type: 'toggle',
    default: CLIPBOARD_PANEL_DEFAULTS.enabled,
  },
  {
    key: 'historyEnabled',
    label: 'Watch clipboard history',
    description:
      'Record copied text and images locally so they appear in the History tab. Turn this off to stop recording; existing history stays until cleared.',
    type: 'toggle',
    default: CLIPBOARD_PANEL_DEFAULTS.historyEnabled,
  },
  {
    key: 'autoPaste',
    label: 'Paste after selecting',
    description:
      'After copying, hide the panel and send Ctrl+V to the window that was focused before. Falls back to copy-only when xdotool or wtype/ydotool is not installed.',
    type: 'toggle',
    default: CLIPBOARD_PANEL_DEFAULTS.autoPaste,
  },
  {
    key: 'klipyApiKey',
    label: 'Klipy API key',
    description:
      'Enables GIF trending and search via Klipy. Get a free test key at partner.klipy.com/api-keys. Stored locally in settings.json.',
    type: 'text',
    default: CLIPBOARD_PANEL_DEFAULTS.klipyApiKey,
    placeholder: 'Paste your Klipy API key',
  },
];
