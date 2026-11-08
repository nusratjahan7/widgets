import { calendarConfig } from './config/calendar.js';
import { clockConfig } from './config/clock.js';
import { cosmeticFields } from './config/common.js';
import { dateCardConfig } from './config/dateCard.js';
import { systemStatsConfig } from './config/systemStats.js';
import type { WidgetConfigSchema } from './config/types.js';
import { weatherConfig } from './config/weather.js';

export const WIDGET_IDS = ['clock', 'dateCard', 'calendar', 'systemStats', 'weather'] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  /** Common cosmetic fields first, then the widget's own fields. */
  config: WidgetConfigSchema;
  commonFieldCount: number;
}

type BaseDefinition = Omit<WidgetDefinition, 'config' | 'commonFieldCount'>;

function withConfig(base: BaseDefinition, specific: WidgetConfigSchema): WidgetDefinition {
  const common = cosmeticFields();
  return {
    ...base,
    config: { fields: [...common, ...specific.fields] },
    commonFieldCount: common.length,
  };
}

export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  clock: withConfig(
    { id: 'clock', title: 'Clock', width: 320, height: 180, minWidth: 220, minHeight: 140 },
    clockConfig,
  ),
  dateCard: withConfig(
    { id: 'dateCard', title: 'Date', width: 320, height: 400, minWidth: 240, minHeight: 320 },
    dateCardConfig,
  ),
  calendar: withConfig(
    { id: 'calendar', title: 'Calendar', width: 300, height: 300, minWidth: 250, minHeight: 250 },
    calendarConfig,
  ),
  systemStats: withConfig(
    { id: 'systemStats', title: 'System', width: 260, height: 260, minWidth: 190, minHeight: 190 },
    systemStatsConfig,
  ),
  weather: withConfig(
    { id: 'weather', title: 'Weather', width: 280, height: 190, minWidth: 220, minHeight: 150 },
    weatherConfig,
  ),
};

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && (WIDGET_IDS as readonly string[]).includes(value);
}
