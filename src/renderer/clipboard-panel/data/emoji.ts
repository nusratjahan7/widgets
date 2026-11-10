import dataByGroup from 'unicode-emoji-json/data-by-group.json';
import components from 'unicode-emoji-json/data-emoji-components.json';

interface RawEmoji {
  emoji?: string;
  skin_tone_support?: boolean;
  name?: string;
  slug?: string;
  emoji_version?: string;
}

interface RawGroup {
  name?: string;
  slug?: string;
  emojis?: RawEmoji[];
}

export interface Emoji {
  char: string;
  name: string;
  supportsTone: boolean;
}

export interface EmojiGroup {
  name: string;
  emojis: Emoji[];
}

export interface SkinTone {
  id: string;
  label: string;
  modifier: string;
  glyph: string;
}

const rawGroups = dataByGroup as unknown as RawGroup[];
const rawComponents = components as unknown as Record<string, string>;

/**
 * Current color-emoji fonts (including Noto Color Emoji) ship glyphs through
 * Emoji 16. Emoji 17 additions have no glyph yet and render as tofu boxes, so
 * hide them until the font catches up.
 */
const MAX_EMOJI_VERSION = 16;

function isRenderable(item: RawEmoji): boolean {
  const version = Number.parseFloat(item.emoji_version ?? '');
  return !Number.isFinite(version) || version <= MAX_EMOJI_VERSION;
}

function component(key: string, fallback: string): string {
  const value = rawComponents[key];
  return typeof value === 'string' && value ? value : fallback;
}

export const emojiGroups: EmojiGroup[] = rawGroups
  .filter((group) => Array.isArray(group.emojis) && group.emojis.length > 0)
  .map((group) => ({
    name: typeof group.name === 'string' && group.name ? group.name : 'Emoji',
    emojis: (group.emojis ?? [])
      .filter(
        (item): item is RawEmoji & { emoji: string } =>
          typeof item.emoji === 'string' && isRenderable(item),
      )
      .map((item) => ({
        char: item.emoji,
        name: typeof item.name === 'string' ? item.name : item.emoji,
        supportsTone: item.skin_tone_support === true,
      })),
  }));

export const SKIN_TONES: SkinTone[] = [
  { id: 'default', label: 'Default', modifier: '', glyph: '○' },
  {
    id: 'light',
    label: 'Light',
    modifier: component('light_skin_tone', '🏻'),
    glyph: component('light_skin_tone', '🏻'),
  },
  {
    id: 'medium-light',
    label: 'Medium light',
    modifier: component('medium_light_skin_tone', '🏼'),
    glyph: component('medium_light_skin_tone', '🏼'),
  },
  {
    id: 'medium',
    label: 'Medium',
    modifier: component('medium_skin_tone', '🏽'),
    glyph: component('medium_skin_tone', '🏽'),
  },
  {
    id: 'medium-dark',
    label: 'Medium dark',
    modifier: component('medium_dark_skin_tone', '🏾'),
    glyph: component('medium_dark_skin_tone', '🏾'),
  },
  {
    id: 'dark',
    label: 'Dark',
    modifier: component('dark_skin_tone', '🏿'),
    glyph: component('dark_skin_tone', '🏿'),
  },
];

/**
 * Unicode `Emoji_Modifier_Base` ranges for the people/hand/body emoji that
 * support a Fitzpatrick modifier. The modifier is inserted after each base so
 * multi-person ZWJ sequences get a tone on each person.
 */
const MODIFIER_BASES: [number, number][] = [
  [0x261d, 0x261d],
  [0x26f9, 0x26f9],
  [0x270a, 0x270d],
  [0x1f385, 0x1f385],
  [0x1f3c2, 0x1f3c4],
  [0x1f3c7, 0x1f3c7],
  [0x1f3ca, 0x1f3ca],
  [0x1f3cb, 0x1f3cc],
  [0x1f442, 0x1f443],
  [0x1f446, 0x1f450],
  [0x1f466, 0x1f478],
  [0x1f47c, 0x1f47c],
  [0x1f481, 0x1f483],
  [0x1f485, 0x1f487],
  [0x1f4aa, 0x1f4aa],
  [0x1f57a, 0x1f57a],
  [0x1f590, 0x1f590],
  [0x1f595, 0x1f596],
  [0x1f645, 0x1f647],
  [0x1f64b, 0x1f64f],
  [0x1f6a3, 0x1f6a3],
  [0x1f6b4, 0x1f6b6],
  [0x1f6c0, 0x1f6c0],
  [0x1f6cc, 0x1f6cc],
  [0x1f90c, 0x1f90f],
  [0x1f918, 0x1f91f],
  [0x1f926, 0x1f926],
  [0x1f930, 0x1f939],
  [0x1f93c, 0x1f93e],
  [0x1f977, 0x1f977],
  [0x1f9b5, 0x1f9b6],
  [0x1f9b8, 0x1f9b9],
  [0x1f9bb, 0x1f9bb],
  [0x1f9cd, 0x1f9cf],
  [0x1f9d1, 0x1f9dd],
  [0x1fac3, 0x1fac5],
  [0x1faf0, 0x1faf8],
];

function isModifierBase(codePoint: number): boolean {
  return MODIFIER_BASES.some(([min, max]) => codePoint >= min && codePoint <= max);
}

export function withSkinTone(char: string, tone: SkinTone): string {
  if (!tone.modifier) return char;

  let result = '';
  for (const point of Array.from(char)) {
    result += point;
    const codePoint = point.codePointAt(0);
    if (codePoint !== undefined && isModifierBase(codePoint)) result += tone.modifier;
  }
  return result;
}

export function searchEmoji(query: string): Emoji[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const results: Emoji[] = [];
  for (const group of emojiGroups) {
    for (const emoji of group.emojis) {
      if (emoji.name.toLowerCase().includes(needle) || emoji.char === query) results.push(emoji);
    }
  }
  return results;
}
