import type { Key } from '@heroui/react';
import { Description, FieldError, Label, ListBox, Select } from '@heroui/react';

type Option = { id: string; name: string; description?: string };

type Props = {
  label: string;
  name?: string;
  placeholder?: string;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  description?: string;
  isRequired?: boolean;
};

export function SelectField({ label, name, placeholder = 'Select', options, value, onChange, error, description, isRequired }: Props) {
  return (
    <Select
      fullWidth
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={(v: Key | Key[] | null) => onChange(v == null || Array.isArray(v) ? null : String(v))}
      isInvalid={!!error}
      isRequired={isRequired}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
              {o.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {error ? <FieldError>{error}</FieldError> : description ? <Description>{description}</Description> : null}
    </Select>
  );
}
