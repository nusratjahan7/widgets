export type Debounced = (() => void) & { cancel(): void };

export function debounce(fn: () => void, delayMs: number): Debounced {
  let timer: NodeJS.Timeout | null = null;

  const run = (() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  }) as Debounced;

  run.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return run;
}
