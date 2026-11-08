import { useEffect, useState } from 'react';
import type { Reminder } from '../../../shared/types';

export function useReminders(): Reminder[] {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    let alive = true;

    const load = () => {
      window.widgets
        .getReminders()
        .then((next) => {
          if (alive) setReminders(next);
        })
        .catch((error: unknown) => console.error('[reminder] load failed', error));
    };

    load();
    const offChange = window.widgets.onReminders(setReminders);
    const offResume = window.widgets.onResume(load);

    return () => {
      alive = false;
      offChange();
      offResume();
    };
  }, []);

  return reminders;
}
