import { useEffect, useState } from 'react';
import { SIZE_PRESETS, isSizePreset, type SizePreset } from '../../shared/config/common';
import type { ConfigValue } from '../../shared/config/types';
import { defaultConfig } from '../../shared/config/values';
import type { WidgetState } from '../../shared/types';
import type { WidgetDefinition, WidgetId } from '../../shared/widgets';
import { Field } from './Field';
import type { SettingsController } from './useSettings';

interface WidgetCustomizeProps {
  id: WidgetId;
  definition: WidgetDefinition;
  state: WidgetState | undefined;
  onBack(): void;
  controller: SettingsController;
}

const SIZE_LABELS: Record<SizePreset, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  custom: 'Custom',
};

export function WidgetCustomize({ id, definition, state, onBack, controller }: WidgetCustomizeProps) {
  const [error, setError] = useState<string | null>(null);

  const config = state?.config ?? defaultConfig(definition.config);
  const size: SizePreset = isSizePreset(config.size) ? config.size : 'medium';

  const common = definition.config.fields.slice(0, definition.commonFieldCount);
  const specific = definition.config.fields.slice(definition.commonFieldCount);

  async function change(key: string, value: ConfigValue) {
    const result = await controller.update({ id, config: { [key]: value } });
    setError(result.error ?? null);
  }

  async function applyPreset(preset: SizePreset) {
    const result = await controller.update({ id, config: { size: preset } });
    setError(result.error ?? null);
  }

  async function applyCustom(width: number, height: number) {
    const result = await controller.update({
      id,
      config: { size: 'custom' },
      size: { width, height },
    });
    setError(result.error ?? null);
  }

  return (
    <>
      <header className="settings-header">
        <div>
          <button type="button" className="settings-btn" onClick={onBack}>
            ← All widgets
          </button>
          <h1 className="settings-title" style={{ marginTop: 14 }}>
            {definition.title}
          </h1>
          <p className="settings-subtitle">Changes apply live to the widget window.</p>
        </div>
      </header>

      {error && <div className="settings-alert">{error}</div>}

      <section className="settings-panel px-4">
        <SizeControl
          definition={definition}
          state={state}
          size={size}
          onPreset={(preset) => void applyPreset(preset)}
          onCustom={(width, height) => void applyCustom(width, height)}
        />

        {common.map((field) => (
          <Field key={field.key} field={field} value={config[field.key]} onChange={(value) => void change(field.key, value)} />
        ))}

        {specific.length > 0 && (
          <div className="settings-field">
            <span className="settings-label" style={{ color: 'var(--muted)' }}>
              {definition.title} options
            </span>
          </div>
        )}

        {specific.map((field) => (
          <Field key={field.key} field={field} value={config[field.key]} onChange={(value) => void change(field.key, value)} />
        ))}
      </section>
    </>
  );
}

interface SizeControlProps {
  definition: WidgetDefinition;
  state: WidgetState | undefined;
  size: SizePreset;
  onPreset(preset: SizePreset): void;
  onCustom(width: number, height: number): void;
}

function SizeControl({ definition, state, size, onPreset, onCustom }: SizeControlProps) {
  const [width, setWidth] = useState(state?.width ?? definition.width);
  const [height, setHeight] = useState(state?.height ?? definition.height);

  useEffect(() => {
    setWidth(state?.width ?? definition.width);
    setHeight(state?.height ?? definition.height);
  }, [state?.width, state?.height, definition.width, definition.height]);

  const commit = () => {
    const nextWidth = Math.max(definition.minWidth, Math.round(width));
    const nextHeight = Math.max(definition.minHeight, Math.round(height));
    onCustom(nextWidth, nextHeight);
  };

  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <div>
          <span className="settings-label">Size</span>
          <p className="settings-help">
            {state ? `${state.width} × ${state.height}px` : `${definition.width} × ${definition.height}px`}
          </p>
        </div>
      </div>

      <div className="settings-controls flex flex-wrap items-center gap-3">
        <div className="settings-seg">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="settings-seg-btn"
              data-active={size === preset}
              onClick={() => onPreset(preset)}
            >
              {SIZE_LABELS[preset]}
            </button>
          ))}
        </div>

        {size === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              className="settings-number"
              type="number"
              min={definition.minWidth}
              value={width}
              aria-label="Width"
              onChange={(event) => setWidth(Number(event.target.value))}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commit();
                  event.currentTarget.blur();
                }
              }}
            />
            <span className="settings-value">×</span>
            <input
              className="settings-number"
              type="number"
              min={definition.minHeight}
              value={height}
              aria-label="Height"
              onChange={(event) => setHeight(Number(event.target.value))}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commit();
                  event.currentTarget.blur();
                }
              }}
            />
            <span className="settings-value">px</span>
          </div>
        )}
      </div>
    </div>
  );
}
