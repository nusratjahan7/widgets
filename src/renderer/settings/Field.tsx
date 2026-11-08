import { useEffect, useState } from 'react';
import type { ColorField, ConfigField, ConfigValue, NumberField, TextField } from '../../shared/config/types';
import { SelectControl } from './SelectControl';

interface FieldProps {
  field: ConfigField;
  value: ConfigValue | undefined;
  onChange(value: ConfigValue): void;
}

export function Field({ field, value, onChange }: FieldProps) {
  switch (field.type) {
    case 'toggle':
      return <ToggleField field={field} value={value} onChange={onChange} />;
    case 'select':
      return <SelectField field={field} value={value} onChange={onChange} />;
    case 'number':
      return <NumberFieldControl field={field} value={value} onChange={onChange} />;
    case 'text':
      return <TextFieldControl field={field} value={value} onChange={onChange} />;
    case 'color':
      return <ColorFieldControl field={field} value={value} onChange={onChange} />;
  }
}

function Label({ label, description }: { label: string; description?: string }) {
  return (
    <div>
      <span className="settings-label">{label}</span>
      {description && <p className="settings-help">{description}</p>}
    </div>
  );
}

function ToggleField({ field, value, onChange }: FieldProps) {
  const on = typeof value === 'boolean' ? value : field.type === 'toggle' ? field.default : false;
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <Label label={field.label} description={field.description} />
        <button
          type="button"
          className="settings-switch"
          role="switch"
          aria-checked={on}
          aria-label={field.label}
          data-on={on}
          onClick={() => onChange(!on)}
        />
      </div>
    </div>
  );
}

function SelectField({ field, value, onChange }: FieldProps) {
  if (field.type !== 'select') return null;
  const current = typeof value === 'string' ? value : field.default;
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <Label label={field.label} description={field.description} />
      </div>
      <div className="settings-controls">
        <SelectControl
          value={current}
          options={field.options}
          ariaLabel={field.label}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function NumberFieldControl({ field, value, onChange }: FieldProps) {
  const number = field as NumberField;
  const current = typeof value === 'number' ? value : number.default;
  const [draft, setDraft] = useState(current);

  useEffect(() => setDraft(current), [current]);

  const commit = () => {
    if (draft !== current) onChange(draft);
  };

  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <Label label={number.label} description={number.description} />
        <span className="settings-value">
          {draft}
          {number.unit ?? ''}
        </span>
      </div>
      <div className="settings-controls">
        <input
          className="settings-range"
          type="range"
          min={number.min}
          max={number.max}
          step={number.step ?? 1}
          value={draft}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

function TextFieldControl({ field, value, onChange }: FieldProps) {
  const text = field as TextField;
  const current = typeof value === 'string' ? value : text.default;
  const [draft, setDraft] = useState(current);

  useEffect(() => setDraft(current), [current]);

  const commit = () => {
    if (draft !== current) onChange(draft);
  };

  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <Label label={text.label} description={text.description} />
      </div>
      <div className="settings-controls">
        <input
          className="settings-input"
          value={draft}
          placeholder={text.placeholder}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}

function ColorFieldControl({ field, value, onChange }: FieldProps) {
  const color = field as ColorField;
  const current = typeof value === 'string' ? value : color.default;
  const auto = current === 'auto';
  const swatch = auto ? (color.default !== 'auto' ? color.default : '#8b7ed6') : current;

  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <Label label={color.label} description={color.description} />
        <span className="settings-value">{auto ? 'Auto' : current}</span>
      </div>
      <div className="settings-controls flex items-center gap-3">
        <input
          type="color"
          value={swatch}
          aria-label={color.label}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        {color.allowAuto && (
          <label className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => onChange(event.target.checked ? 'auto' : swatch)}
            />
            Auto
          </label>
        )}
      </div>
    </div>
  );
}
