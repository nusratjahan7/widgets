import type { Reminder, ReminderRepeat } from './types.js';

export const REMINDER_REPEATS: readonly ReminderRepeat[] = ['none', 'daily', 'weekly', 'monthly'];

export const REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

export function isTimeKey(value: unknown): value is string {
  return typeof value === 'string' && TIME_KEY.test(value);
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function parseMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatClock(time: string, hour12: boolean): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (!hour12) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export interface ReminderOccurrence {
  reminder: Reminder;
  start: number;
  end: number | null;
  day: string;
}

export function occursOn(reminder: Reminder, day: Date): boolean {
  const key = dateKey(day);
  if (reminder.date === key) return true;
  if (reminder.repeat === 'none' || key < reminder.date) return false;

  const start = parseDateKey(reminder.date);
  switch (reminder.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return day.getDay() === start.getDay();
    case 'monthly':
      return day.getDate() === start.getDate();
  }
}

export function occurrencesForDay(reminders: Reminder[], day: Date): ReminderOccurrence[] {
  return reminders
    .filter((reminder) => occursOn(reminder, day))
    .map((reminder) => {
      const start = parseMinutes(reminder.start);
      const end = reminder.end && isTimeKey(reminder.end) ? parseMinutes(reminder.end) : null;
      return { reminder, start, end: end !== null && end > start ? end : null, day: dateKey(day) };
    })
    .sort((a, b) => a.start - b.start || a.reminder.title.localeCompare(b.reminder.title));
}

export function upcomingForDay(reminders: Reminder[], now: Date): ReminderOccurrence[] {
  const current = minutesSinceMidnight(now);
  return occurrencesForDay(reminders, now).filter(({ start, end }) => (end ?? start) >= current);
}
