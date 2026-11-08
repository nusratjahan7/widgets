import { useEffect, useRef, useState } from 'react';
import { applyTheme } from './lib/theme';

/**
 * Small transient popover for the weather location. It has to be a normal
 * window: the desktop-layer widget windows cannot take keyboard focus.
 */
export function CityEditor() {
  const [value, setValue] = useState(() => new URLSearchParams(window.location.search).get('city') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.widgets
      .getAppearance()
      .then((appearance) => applyTheme(appearance.theme, appearance.resolvedTheme))
      .catch(() => {});
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit() {
    const city = value.trim();
    if (!city || busy) return;

    setBusy(true);
    const result = await window.widgets.setWeatherCity(city);
    setBusy(false);

    if (result.ok) window.close();
    else setError(result.error ?? 'Lookup failed.');
  }

  return (
    <div className="card editor-card">
      <span className="overline">Weather location</span>

      <input
        ref={inputRef}
        autoFocus
        className="field-input"
        value={value}
        spellCheck={false}
        placeholder="City name"
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submit();
          if (event.key === 'Escape') window.close();
        }}
        onBlur={() => window.setTimeout(() => window.close(), 160)}
      />

      <span className={error ? 'editor-error' : 'editor-hint'}>
        {error ?? (busy ? 'Looking up…' : 'Enter to save · Esc to cancel')}
      </span>
    </div>
  );
}
