import type { ReactNode } from 'react';
import { Description, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';

type Props = {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  description?: ReactNode;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'time' | 'number';
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  isRequired?: boolean;
  multiline?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
};

/** Labelled text input with helper/error text (design.md §7 input anatomy). */
export function TextInput({ label, name, value, onChange, error, description, placeholder, type = 'text', autoComplete, inputMode, isRequired, multiline, maxLength, min, max }: Props) {
  return (
    <TextField fullWidth name={name} value={value} onChange={onChange} isInvalid={!!error} isRequired={isRequired} type={type} maxLength={maxLength}>
      <Label>{label}</Label>
      {multiline ? (
        <TextArea placeholder={placeholder} rows={3} />
      ) : (
        <Input placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} min={min} max={max} />
      )}
      {error ? <FieldError>{error}</FieldError> : description ? <Description>{description}</Description> : null}
    </TextField>
  );
}
