import type { WidgetConfigSchema } from './types.js';

export const weatherConfig: WidgetConfigSchema = {
  fields: [
    {
      key: 'city',
      label: 'City',
      description: 'Changing this updates the app-wide weather location.',
      type: 'text',
      default: '',
      placeholder: 'Current location',
    },
    {
      key: 'units',
      label: 'Units',
      type: 'select',
      default: 'metric',
      options: [
        { value: 'metric', label: 'Celsius' },
        { value: 'imperial', label: 'Fahrenheit' },
      ],
    },
  ],
};
