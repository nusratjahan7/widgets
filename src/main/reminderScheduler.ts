import { Notification, powerMonitor } from 'electron';
import { formatClock, occurrencesForDay, type ReminderOccurrence } from '../shared/reminders.js';
import { getWidgetConfig } from './settings.js';
import { listReminders } from './reminders.js';

const POLL_MS = 20_000;
const fired = new Set<string>();

function showNotification(occurrence: ReminderOccurrence, hour12: boolean): void {
  const key = `${occurrence.reminder.id}:${occurrence.day}:${occurrence.start}`;
  if (fired.has(key)) return;
  fired.add(key);
  if (fired.size > 500) fired.clear();

  const range = occurrence.reminder.end
    ? `${formatClock(occurrence.reminder.start, hour12)} - ${formatClock(occurrence.reminder.end, hour12)}`
    : formatClock(occurrence.reminder.start, hour12);

  new Notification({ title: occurrence.reminder.title, body: range }).show();
}

export function checkReminders(): void {
  const config = getWidgetConfig('reminder');
  if (config.notifications === false) return;
  if (!Notification.isSupported()) return;

  const now = new Date();
  const hour12 = config.hour12 === true;
  const defaultLead = typeof config.leadMinutes === 'number' ? config.leadMinutes : 0;

  for (const occurrence of occurrencesForDay(listReminders(), now)) {
    const lead = Math.max(0, occurrence.reminder.leadMinutes ?? defaultLead);
    const trigger = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(occurrence.start / 60),
      occurrence.start % 60,
      0,
      0,
    );
    const diff = now.getTime() - (trigger.getTime() - lead * 60_000);
    if (diff >= 0 && diff < 60_000) showNotification(occurrence, hour12);
  }
}

export function startReminderScheduler(): void {
  checkReminders();
  setInterval(checkReminders, POLL_MS);
  powerMonitor.on('resume', checkReminders);
}
