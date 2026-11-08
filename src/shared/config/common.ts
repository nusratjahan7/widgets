import type { ConfigField } from './types.js';

export const SIZE_PRESETS = ['small', 'medium', 'large', 'custom'] as const;

export type SizePreset = (typeof SIZE_PRESETS)[number];

export const SIZE_SCALES: Record<Exclude<SizePreset, 'custom'>, number> = {
  small: 0.85,
  medium: 1,
  large: 1.25,
};

export function isSizePreset(value: unknown): value is SizePreset {
  return typeof value === 'string' && (SIZE_PRESETS as readonly string[]).includes(value);
}

export interface SizeableDefinition {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export function sizeForPreset(definition: SizeableDefinition, preset: SizePreset): { width: number; height: number } {
  if (preset === 'custom') return { width: definition.width, height: definition.height };
  const scale = SIZE_SCALES[preset];
  return {
    width: Math.max(definition.minWidth, Math.round(definition.width * scale)),
    height: Math.max(definition.minHeight, Math.round(definition.height * scale)),
  };
}

/** Cosmetic options shared by every widget. Rendered generically in Settings. */
export function cosmeticFields(): ConfigField[] {
  return [
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'number',
      default: 1,
      min: 0.2,
      max: 1,
      step: 0.05,
    },
    {
      key: 'background',
      label: 'Background',
      type: 'select',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Widget default' },
        { value: 'solid', label: 'Solid' },
        { value: 'glass', label: 'Glass' },
        { value: 'transparent', label: 'Transparent' },
      ],
    },
    {
      key: 'accent',
      label: 'Accent color',
      description: 'Leave on Auto to follow the app accent.',
      type: 'color',
      default: 'auto',
      allowAuto: true,
    },
    {
      key: 'textColor',
      label: 'Text color',
      description: 'Leave on Auto to follow the theme.',
      type: 'color',
      default: 'auto',
      allowAuto: true,
    },
    {
      key: 'radius',
      label: 'Corner radius',
      type: 'number',
      default: 26,
      min: 0,
      max: 40,
      step: 1,
      unit: 'px',
    },
    {
      key: 'locked',
      label: 'Lock position',
      description: 'Prevent dragging and resizing this widget.',
      type: 'toggle',
      default: false,
    },
  ];
}
