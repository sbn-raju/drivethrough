import { InputOTP } from '@heroui/react';

export function OtpInput({ value, onChange, onComplete, isInvalid, isDisabled, describedBy }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  isInvalid?: boolean;
  isDisabled?: boolean;
  describedBy?: string;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ''))}
      onComplete={onComplete}
      isInvalid={isInvalid}
      isDisabled={isDisabled}
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="6-digit verification code"
      aria-describedby={describedBy}
      autoFocus
    >
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        <InputOTP.Slot index={3} />
        <InputOTP.Slot index={4} />
        <InputOTP.Slot index={5} />
      </InputOTP.Group>
    </InputOTP>
  );
}
