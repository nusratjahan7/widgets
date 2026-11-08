import type { WidgetConfigSchema } from './types.js';

export const dateCardConfig: WidgetConfigSchema = {
  fields: [
    { key: 'showTime', label: 'Show time', type: 'toggle', default: true },
    { key: 'hour12', label: '12-hour clock', type: 'toggle', default: false },
  ],
};
