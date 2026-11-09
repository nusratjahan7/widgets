import { useCallback, useState } from 'react';

/** Icons either side of the pointer shrink with distance, like Big Sur's dock. */
const FALLOFF = 0.55;

/**
 * Returns the scale for an icon at `index` given the currently hovered one.
 * `zoom` is the peak scale (1 = no magnification).
 */
export function useMagnification(zoom: number) {
  const [hovered, setHovered] = useState<number | null>(null);

  const scaleFor = useCallback(
    (index: number): number => {
      if (hovered === null || zoom <= 1) return 1;
      const distance = Math.abs(index - hovered);
      if (distance > 3) return 1;
      return 1 + (zoom - 1) * FALLOFF ** distance;
    },
    [hovered, zoom],
  );

  return { hovered, setHovered, scaleFor };
}
