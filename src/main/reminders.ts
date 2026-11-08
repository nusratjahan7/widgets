import { randomUUID } from 'node:crypto';
import Store from 'electron-store';
import { isHexColor, isRecord } from '../shared/config/values.js';
import { isDateKey, isTimeKey, parseMinutes, REMINDER_REPEATS } from '../shared/reminders.js';
import { IPC } from '../shared/ipc.js';
import type { Reminder, ReminderRepeat } from '../shared/types.js';
import { broadcast } from './windowManager.js';

interface ReminderStore {
  reminders: Reminder[];
}

export const reminderStore = new Store<ReminderStore>({
  name: 'reminders',
  defaults: { reminders: [] },
  clearInvalidConfig: true,
});

const DEFAULT_COLOR = '#34c759';

function repeatOf(value: unknown): ReminderRepeat {
  return typeof value === 'string' && (REMINDER_REPEATS as readonly string[]).includes(value)
    ? (value as ReminderRepeat)
    : 'none';
}

function leadOf(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(1440, Math.max(0, Math.round(value)));
}

function sanitize(raw: unknown): Reminder | null {
  if (!isRecord(raw)) return null;

  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '';
  if (!title) return null;
  if (!isDateKey(raw.date) || !isTimeKey(raw.start)) return null;

  const end = isTimeKey(raw.end) && parseMinutes(raw.end) > parseMinutes(raw.start) ? raw.end : undefined;
  const lead = leadOf(raw.leadMinutes);

  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : randomUUID(),
    title,
    date: raw.date,
    start: raw.start,
    ...(end ? { end } : {}),
    color: isHexColor(raw.color) ? raw.color.toLowerCase() : DEFAULT_COLOR,
    repeat: repeatOf(raw.repeat),
    ...(lead !== undefined ? { leadMinutes: lead } : {}),
  };
}

export function listReminders(): Reminder[] {
  const stored = reminderStore.get('reminders');
  if (!Array.isArray(stored)) return [];
  return stored.map(sanitize).filter((reminder): reminder is Reminder => reminder !== null);
}

function persist(reminders: Reminder[]): Reminder[] {
  reminderStore.set('reminders', reminders);
  const next = listReminders();
  broadcast(IPC.remindersChange, next);
  return next;
}

export function saveReminder(raw: unknown): Reminder[] {
  if (!isRecord(raw)) throw new Error('Invalid reminder.');

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) throw new Error('Add a title.');
  if (!isDateKey(raw.date)) throw new Error('Pick a valid date.');
  if (!isTimeKey(raw.start)) throw new Error('Pick a start time.');
  if (raw.end !== undefined && raw.end !== '' && !isTimeKey(raw.end)) throw new Error('Pick a valid end time.');
  if (isTimeKey(raw.end) && parseMinutes(raw.end) <= parseMinutes(raw.start)) {
    throw new Error('End time must be after the start time.');
  }

  const current = listReminders();
  const id = typeof raw.id === 'string' ? raw.id : '';
  const existing = current.find((reminder) => reminder.id === id);
  const reminder = sanitize({
    ...raw,
    id: existing ? existing.id : randomUUID(),
    title,
  });
  if (!reminder) throw new Error('Invalid reminder.');

  const next = existing
    ? current.map((candidate) => (candidate.id === reminder.id ? reminder : candidate))
    : [...current, reminder];

  return persist(next);
}

export function deleteReminder(id: unknown): Reminder[] {
  if (typeof id !== 'string') return listReminders();
  return persist(listReminders().filter((reminder) => reminder.id !== id));
}
