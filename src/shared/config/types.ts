export type ConfigValue = string | number | boolean;

export type WidgetConfig = Record<string, ConfigValue>;

interface FieldBase {
  key: string;
  label: string;
  description?: string;
}

export interface ToggleField extends FieldBase {
  type: 'toggle';
  default: boolean;
}

export interface SelectField extends FieldBase {
  type: 'select';
  default: string;
  options: { value: string; label: string }[];
}

export interface NumberField extends FieldBase {
  type: 'number';
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface TextField extends FieldBase {
  type: 'text';
  default: string;
  placeholder?: string;
}

export interface ColorField extends FieldBase {
  type: 'color';
  default: string;
  allowAuto?: boolean;
}

export type ConfigField = ToggleField | SelectField | NumberField | TextField | ColorField;

export interface WidgetConfigSchema {
  fields: ConfigField[];
}
