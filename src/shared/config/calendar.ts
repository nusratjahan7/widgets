import type { WidgetConfigSchema } from './types.js';

export const calendarConfig: WidgetConfigSchema = {
  fields: [
    {
      key: 'weekStart',
      label: 'Week starts on',
      type: 'select',
      default: 'sunday',
      options: [
        { value: 'sunday', label: 'Sunday' },
        { value: 'monday', label: 'Monday' },
      ],
    },
  ],
};
