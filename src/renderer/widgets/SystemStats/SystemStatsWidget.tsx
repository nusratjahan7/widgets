import { Mark } from '../../components/Mark';
import { WidgetFrame } from '../../components/WidgetFrame';
import { useWidgetContext } from '../../state/WidgetProvider';

export function SystemStatsWidget() {
  const { context, stats } = useWidgetContext();
  const config = context.config;

  return (
    <WidgetFrame className="system-card flex flex-col justify-between p-[8cqw]">
      <Mark className="w-[44%] h-auto" />

      <div className="flex flex-col gap-[1.6cqw]">
        {config.showCpu !== false && <Stat label="CPU" value={stats?.cpu} />}
        {config.showMemory !== false && <Stat label="RAM" value={stats?.memory} />}
        {config.showDisk !== false && <Stat label="SSD" value={stats?.disk} />}
      </div>
    </WidgetFrame>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="system-stat flex items-baseline gap-[2.4cqw]">
      <span>{label}</span>
      <span className="system-stat-value">{value === undefined ? '–' : `${value}%`}</span>
    </div>
  );
}
