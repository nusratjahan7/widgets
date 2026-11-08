import type { WidgetConfigSchema } from './types.js';

export const clockConfig: WidgetConfigSchema = {
  fields: [
    { key: 'hour12', label: '12-hour clock', type: 'toggle', default: false },
    { key: 'showSeconds', label: 'Show seconds', type: 'toggle', default: true },
    { key: 'showDate', label: 'Show date', type: 'toggle', default: true },
    {
      key: 'timezone',
      label: 'Time zone',
      description: 'IANA zone name, e.g. Europe/London. Empty uses local time.',
      type: 'text',
      default: '',
      placeholder: 'Local time',
    },
  ],
};
