import type { WidgetConfigSchema } from './types.js';

export const systemStatsConfig: WidgetConfigSchema = {
  fields: [
    { key: 'showCpu', label: 'Show CPU', type: 'toggle', default: true },
    { key: 'showMemory', label: 'Show RAM', type: 'toggle', default: true },
    { key: 'showDisk', label: 'Show SSD', type: 'toggle', default: true },
  ],
};
