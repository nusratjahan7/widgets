import type { WeatherIconName } from './conditions';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const CLOUD_PATH =
  'M11.4 22.2h10.4a4.3 4.3 0 0 0 .4-8.6 6.1 6.1 0 0 0-11.6-1.3 4.5 4.5 0 0 0 .8 9.9Z';

function Cloud() {
  return <path d={CLOUD_PATH} />;
}

function Sun() {
  return (
    <>
      <circle cx="16" cy="16" r="5.3" />
      <path d="M16 3.6v3M16 25.4v3M3.6 16h3M25.4 16h3M7.2 7.2l2.1 2.1M22.7 22.7l2.1 2.1M24.8 7.2l-2.1 2.1M9.3 22.7l-2.1 2.1" />
    </>
  );
}

export function WeatherIcon({ name, className }: { name: WeatherIconName; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...stroke} aria-hidden="true">
      {name === 'sun' && <Sun />}

      {name === 'moon' && (
        <path d="M23.4 19.8A9 9 0 0 1 12.2 8.6a8.2 8.2 0 1 0 11.2 11.2Z" />
      )}

      {name === 'partly' && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 3.2v2.4M4.4 12H2M18 6.4l-1.6 1.6M5.9 5.9 7.5 7.5" />
          <path d="M13.6 24.4h10.2a3.9 3.9 0 0 0 .4-7.8 5.6 5.6 0 0 0-10.6-1.2 4.1 4.1 0 0 0 0 9Z" />
        </>
      )}

      {name === 'cloud' && <Cloud />}

      {name === 'fog' && (
        <>
          <Cloud />
          <path d="M9 25.6h14M11.5 28.4h9" />
        </>
      )}

      {name === 'drizzle' && (
        <>
          <Cloud />
          <path d="M12.6 25.2l-.7 2.2M17 25.2l-.7 2.2M21.4 25.2l-.7 2.2" />
        </>
      )}

      {name === 'rain' && (
        <>
          <Cloud />
          <path d="M11.8 24.8 9.8 29M16.4 24.8 14.4 29M21 24.8 19 29" />
        </>
      )}

      {name === 'snow' && (
        <>
          <Cloud />
          <path d="M12 25.8v4M10.4 26.8l3.2 2M13.6 26.8l-3.2 2M20.4 25.8v4M18.8 26.8l3.2 2M22 26.8l-3.2 2" />
        </>
      )}

      {name === 'storm' && (
        <>
          <Cloud />
          <path d="M17.4 23.4 14 28.4h3.2l-1 3.4 4.6-5.4h-3.2l1.2-3Z" />
        </>
      )}
    </svg>
  );
}
