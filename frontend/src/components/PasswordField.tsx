import { useState } from 'react';
import { Button, Description, FieldError, InputGroup, Label, TextField } from '@heroui/react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  description?: string;
  autoComplete?: 'current-password' | 'new-password';
  isRequired?: boolean;
};

export function PasswordField({ label = 'Password', name = 'password', value, onChange, error, description, autoComplete = 'current-password', isRequired = true }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField fullWidth name={name} value={value} onChange={onChange} isInvalid={!!error} isRequired={isRequired}>
      <Label>{label}</Label>
      <InputGroup>
        <InputGroup.Input className="w-full" type={visible ? 'text' : 'password'} autoComplete={autoComplete} />
        <InputGroup.Suffix className="pe-0">
          <Button isIconOnly size="sm" variant="ghost" aria-label={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible((v) => !v)}>
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {error ? <FieldError>{error}</FieldError> : description ? <Description>{description}</Description> : null}
    </TextField>
  );
}

