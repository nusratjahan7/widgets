import { WidgetFrame } from '../../components/WidgetFrame';
import { useNow } from '../../hooks/useNow';
import { longDate, timeParts, weekday } from '../../lib/time';
import { useWidgetContext } from '../../state/WidgetProvider';

export function ClockWidget() {
  const { context } = useWidgetContext();
  const config = context.config;

  const hour12 = config.hour12 === true;
  const showSeconds = config.showSeconds !== false;
  const showDate = config.showDate !== false;
  const timeZone =
    typeof config.timezone === 'string' && config.timezone.trim() !== '' ? config.timezone.trim() : undefined;

  const now = useNow(showSeconds ? 1000 : 30_000);
  const time = timeParts(now, { hour12, timeZone });

  return (
    <WidgetFrame className="flex flex-col justify-between px-[10cqw] py-[7.5cqw]">
      <div>
        <div className="clock-head">
          <span className="clock-time">
            {time.hours}
            <span className="clock-colon">:</span>
            {time.minutes}
          </span>
          {showSeconds && <span className="clock-seconds">{time.seconds}</span>}
          {hour12 && time.period && <span className="clock-period">{time.period}</span>}
        </div>
        <span className="clock-divider" />
      </div>

      <div className="flex flex-col gap-[8cqw]">
        {showDate && (
          <span className="clock-date">
            {weekday(now)} <span className="clock-dot">•</span> {longDate(now)}
          </span>
        )}
        <span className="accent-rule" />
      </div>
    </WidgetFrame>
  );
}
