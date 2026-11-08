import type { WidgetConfigSchema } from './types.js';

export const reminderConfig: WidgetConfigSchema = {
  fields: [
    {
      key: 'cardTheme',
      label: 'Theme',
      type: 'select',
      default: 'light',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'glass', label: 'Glass' },
      ],
    },
    { key: 'weekdayColor', label: 'Weekday color', type: 'color', default: '#ff2d55' },
    { key: 'defaultReminderColor', label: 'Default reminder color', type: 'color', default: '#34c759' },
    {
      key: 'maxReminders',
      label: 'Reminders shown',
      type: 'number',
      default: 1,
      min: 1,
      max: 3,
      step: 1,
    },
    { key: 'hour12', label: '12-hour time', type: 'toggle', default: true },
    { key: 'notifications', label: 'Notifications', type: 'toggle', default: true },
    {
      key: 'leadMinutes',
      label: 'Default lead time',
      description: 'Minutes before the start time to notify. Reminders can override this.',
      type: 'number',
      default: 0,
      min: 0,
      max: 120,
      step: 5,
      unit: 'min',
    },
  ],
};
