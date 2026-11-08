import type { CSSProperties } from 'react';
import { WidgetFrame } from '../../components/WidgetFrame';
import { useMinuteClock } from '../../hooks/useMinuteClock';
import { formatShortDate, timeParts, weekday, type ShortDateFormat } from '../../lib/time';
import { useWidgetContext } from '../../state/WidgetProvider';

const DATE_FORMATS: readonly ShortDateFormat[] = ['month-day', 'day-month', 'numeric'];
const GRADIENTS = ['purple', 'blue', 'pink', 'sunset', 'dark'] as const;
const NUMERAL_FONTS = {
  bebas: '"Bebas Neue", "Oswald", sans-serif',
  anton: '"Anton", "Bebas Neue", sans-serif',
  oswald: '"Oswald", "Bebas Neue", sans-serif',
} as const;
const SCRIPT_FONTS = {
  pacifico: '"Pacifico", cursive',
  dancing: '"Dancing Script", cursive',
} as const;

type Gradient = (typeof GRADIENTS)[number];
type NumeralFont = keyof typeof NUMERAL_FONTS;
type ScriptFont = keyof typeof SCRIPT_FONTS;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function hexToRgba(hex: string | null, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function DateCardWidget() {
  const { context } = useWidgetContext();
  const config = context.config;

  const showTime = config.showTime !== false;
  const hour12 = config.hour12 === true;
  const showWeekday = config.showWeekday !== false;
  const showDate = config.showDate !== false;
  const dateFormat = pick(config.dateFormat, DATE_FORMATS, 'month-day');
  const gradient = pick<Gradient>(config.gradient, GRADIENTS, 'purple');
  const numeralFont = pick<NumeralFont>(config.numeralFont, Object.keys(NUMERAL_FONTS) as NumeralFont[], 'bebas');
  const scriptFont = pick<ScriptFont>(config.scriptFont, Object.keys(SCRIPT_FONTS) as ScriptFont[], 'pacifico');

  const outlineWidth = numberOr(config.outlineWidth, 2);
  const fillOpacity = numberOr(config.fillOpacity, 0.12);
  const bgOpacity = numberOr(config.bgOpacity, 0.55);
  const blur = numberOr(config.blur, 18);

  const textColor = typeof config.textColor === 'string' && config.textColor !== 'auto' ? config.textColor : null;
  const background = typeof config.background === 'string' ? config.background : 'auto';

  const now = useMinuteClock();
  const time = timeParts(now, { hour12 });
  const hour = time.hours.replace(/^0(?=\d)/, '');
  const bigTimeLength = hour.length + 1 + time.minutes.length;
  const cornerTime = `${time.hours}:${time.minutes}${time.period ? ` ${time.period}` : ''}`;
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const style = {
    '--dc-blur': `${blur}px`,
    '--dc-bg-opacity': String(bgOpacity),
    '--dc-stroke': `${outlineWidth}px`,
    '--dc-stroke-color': hexToRgba(textColor, 0.92),
    '--dc-fill': hexToRgba(textColor, fillOpacity),
    '--dc-numeral-font': NUMERAL_FONTS[numeralFont],
    '--dc-script-font': SCRIPT_FONTS[scriptFont],
  } as CSSProperties;

  return (
    <WidgetFrame className="date-card">
      <div className="dc-root" style={style}>
        {background !== 'solid' && background !== 'transparent' && (
          <div className="dc-bg" data-gradient={gradient} />
        )}
        <div className="dc-inset" />

        <div className="dc-face">
          {showTime && <span className="dc-corner">{cornerTime}</span>}

          {showTime && (
            <span className="dc-numerals" data-len={bigTimeLength} data-font={numeralFont}>
              {hour}
              <span className="dc-colon">:</span>
              {time.minutes}
            </span>
          )}

          <div className="dc-caption" key={dayKey}>
            {showWeekday && <span className="dc-weekday">{weekday(now)}</span>}
            {showDate && <span className="dc-date">{formatShortDate(now, dateFormat)}</span>}
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}
