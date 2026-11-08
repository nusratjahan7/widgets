import { isSizePreset } from './common.js';
import type { ConfigField, ConfigValue, WidgetConfig, WidgetConfigSchema } from './types.js';

const HEX = /^#[0-9a-f]{6}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/** Defaults for a widget, including the structural `size` key. */
export function defaultConfig(schema: WidgetConfigSchema): WidgetConfig {
  const config: WidgetConfig = { size: 'medium' };
  for (const field of schema.fields) config[field.key] = field.default;
  return config;
}

function coerce(field: ConfigField, value: unknown): ConfigValue {
  switch (field.type) {
    case 'toggle':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return field.default;

    case 'select':
      return typeof value === 'string' && field.options.some((option) => option.value === value)
        ? value
        : field.default;

    case 'number': {
      const numeric =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : Number.NaN;
      if (!Number.isFinite(numeric)) return field.default;
      return Math.min(field.max, Math.max(field.min, numeric));
    }

    case 'text':
      return typeof value === 'string' ? value.slice(0, 120) : field.default;

    case 'color':
      if (field.allowAuto && value === 'auto') return 'auto';
      return isHexColor(value) ? value.toLowerCase() : field.default;
  }
}

/** Drops unknown keys, clamps numbers, checks enums, and restores missing defaults. */
export function sanitizeConfig(schema: WidgetConfigSchema, raw: unknown): WidgetConfig {
  const source = isRecord(raw) ? raw : {};
  const config = defaultConfig(schema);

  for (const field of schema.fields) {
    if (field.key in source) config[field.key] = coerce(field, source[field.key]);
  }

  config.size = isSizePreset(source.size) ? source.size : 'medium';
  return config;
}
