export function formatTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function weekday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export function longDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type ShortDateFormat = 'month-day' | 'day-month' | 'numeric';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(date: Date, format: ShortDateFormat): string {
  const day = date.getDate();
  const month = SHORT_MONTHS[date.getMonth()];

  if (format === 'numeric') {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (format === 'day-month') return `${day} ${month}`;
  return `${month} ${day}`;
}

export interface TimeParts {
  hours: string;
  minutes: string;
  seconds: string;
  period?: string;
}

interface TimeOptions {
  hour12?: boolean;
  timeZone?: string;
}

function partsInZone(date: Date, options: TimeOptions): TimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: Boolean(options.hour12),
    timeZone: options.timeZone,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    hours: get('hour').padStart(2, '0'),
    minutes: get('minute').padStart(2, '0'),
    seconds: get('second').padStart(2, '0'),
    period: options.hour12 ? get('dayPeriod') : undefined,
  };
}

/** Splits a time into styled parts, honouring 12/24h and an optional IANA zone. */
export function timeParts(date: Date, options: TimeOptions = {}): TimeParts {
  try {
    return partsInZone(date, options);
  } catch {
    // Invalid time zone name: fall back to local time.
    return partsInZone(date, { hour12: options.hour12 });
  }
}
