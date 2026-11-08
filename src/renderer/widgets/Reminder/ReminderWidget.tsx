import type { CSSProperties } from 'react';
import { WidgetFrame } from '../../components/WidgetFrame';
import { useMinuteClock } from '../../hooks/useMinuteClock';
import { formatClock, upcomingForDay } from '../../../shared/reminders';
import { useWidgetContext } from '../../state/WidgetProvider';
import { useReminders } from './useReminders';

const THEMES = ['light', 'dark', 'glass'] as const;
type ReminderTheme = (typeof THEMES)[number];

const HEX = /^#[0-9a-f]{6}$/i;

function themeOf(value: unknown): ReminderTheme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
    ? (value as ReminderTheme)
    : 'light';
}

function colorOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

export function ReminderWidget() {
  const { context } = useWidgetContext();
  const config = context.config;

  const now = useMinuteClock();
  const reminders = useReminders();

  const theme = themeOf(config.cardTheme);
  const weekdayColor = colorOf(config.weekdayColor, '#ff2d55');
  const hour12 = config.hour12 !== false;
  const maxReminders = Math.min(
    3,
    Math.max(1, typeof config.maxReminders === 'number' ? Math.round(config.maxReminders) : 1),
  );

  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const upcoming = upcomingForDay(reminders, now).slice(0, maxReminders);

  const style = { '--reminder-weekday': weekdayColor } as CSSProperties;

  return (
    <WidgetFrame
      className={`reminder-card reminder-theme-${theme}`}
      onActivate={() => void window.widgets.openReminderEditor()}
    >
      <div className="absolute inset-0 flex flex-col p-[8.5%]" style={style}>
        <div className="flex items-baseline gap-[2.4cqw]">
          <span className="reminder-weekday">{weekday}</span>
          <span className="reminder-month">{month}</span>
        </div>

        <span className="reminder-day">{now.getDate()}</span>

        <div className="mt-auto flex flex-col gap-[2.8cqw] pb-[1%]">
          {upcoming.length === 0 ? (
            <div className="flex flex-col gap-[0.8cqw]">
              <span className="reminder-empty-title">No reminders</span>
              <span className="reminder-empty-hint">Tap to add one</span>
            </div>
          ) : (
            upcoming.map(({ reminder, start, end }) => (
              <div className="reminder-item flex items-stretch gap-[3.2cqw]" key={`${reminder.id}-${start}`}>
                <span
                  className="w-[1.5cqw] min-w-[3px] shrink-0 rounded-full"
                  style={{ background: reminder.color }}
                />
                <div className="flex min-w-0 flex-col gap-[0.5cqw]">
                  <span className="reminder-title">{reminder.title}</span>
                  <span className="reminder-time">
                    {formatClock(reminder.start, hour12)}
                    {end !== null && reminder.end ? ` - ${formatClock(reminder.end, hour12)}` : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}
