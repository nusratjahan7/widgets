import { WidgetFrame } from '../../components/WidgetFrame';
import { useNow } from '../../hooks/useNow';
import { shortDate, timeParts, weekday } from '../../lib/time';
import { useWidgetContext } from '../../state/WidgetProvider';

export function DateCardWidget() {
  const { context } = useWidgetContext();
  const config = context.config;

  const showTime = config.showTime !== false;
  const hour12 = config.hour12 === true;

  const now = useNow(30_000);
  const time = timeParts(now, { hour12 });
  const displayTime = time.period ? `${time.hours}:${time.minutes} ${time.period}` : `${time.hours}:${time.minutes}`;
  const numerals = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  return (
    <WidgetFrame className="date-card">
      <div className="date-inset">
        {showTime && <span className="date-time">{displayTime}</span>}
        <span className="date-numerals">{numerals}</span>
        <span className="date-script">{weekday(now)}</span>
        <span className="date-label">{shortDate(now)}</span>
      </div>
    </WidgetFrame>
  );
}
