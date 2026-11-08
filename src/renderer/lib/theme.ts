import type { ResolvedTheme, ThemeSettings } from '../../shared/types';

export function applyTheme(theme: ThemeSettings, resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.setProperty('--accent', theme.accent);
}
