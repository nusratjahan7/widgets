import { WidgetFrame } from '../../components/WidgetFrame';
import { useNow } from '../../hooks/useNow';
import { useWidgetContext } from '../../state/WidgetProvider';

const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarWidget() {
  const { context } = useWidgetContext();
  const mondayFirst = context.config.weekStart === 'monday';

  const now = useNow(30_000);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const sundayIndex = new Date(year, month, 1).getDay();
  const firstWeekday = mondayFirst ? (sundayIndex + 6) % 7 : sundayIndex;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  // Always keep six week slots so the grid doesn't jump between months.
  while (cells.length < 42) cells.push(null);

  const currentWeek = Math.floor((firstWeekday + today - 1) / 7);
  const weekdays = mondayFirst ? MONDAY_FIRST : SUNDAY_FIRST;
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long' });

  return (
    <WidgetFrame className="calendar-card flex flex-col justify-center gap-[2.2cqw] px-[6cqw] py-[6.5cqw]">
      <span className="calendar-month">{monthLabel}</span>

      <div className="grid grid-cols-7">
        {weekdays.map((label, index) => (
          <span key={index} className="calendar-head">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => (
          <div
            key={index}
            className="calendar-day"
            data-active={day !== null && Math.floor(index / 7) === currentWeek}
            data-today={day === today}
          >
            {day !== null && <span>{day}</span>}
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}
