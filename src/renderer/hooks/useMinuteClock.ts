import { useEffect, useState } from 'react';

const MINUTE = 60_000;

function msUntilNextMinute(): number {
  return MINUTE - (Date.now() % MINUTE);
}

export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number | null = null;

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextMinute() + 50);
    };

    const sync = () => {
      setNow(new Date());
      schedule();
    };

    schedule();
    const off = window.widgets.onResume(sync);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      off();
    };
  }, []);

  return now;
}
