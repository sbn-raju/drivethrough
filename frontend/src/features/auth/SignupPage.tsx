import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, Checkbox, Description, Form, Label, Radio, RadioGroup, Spinner } from '@heroui/react';
import { CarFront, UserRound } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { FormAlert } from '../../components/FormAlert';
import { PasswordField } from '../../components/PasswordField';
import { TextInput } from '../../components/TextInput';
import { ApiError, errorMessage, post } from '../../lib/api';
import { savePending, type PendingVerification } from './pending';

type Role = 'consumer' | 'driver';

const roles = [
  { value: 'consumer' as const, icon: CarFront, title: 'Book a driver', text: 'Get a professional driver for your own car.' },
  { value: 'driver' as const, icon: UserRound, title: 'Drive with DriveThrough', text: 'Offer your driving services to vehicle owners.' },
];

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(params.get('role') === 'driver' ? 'driver' : 'consumer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const local: Record<string, string> = {};
    if (!email.trim() && !phone.trim()) local.email = 'Enter an email address or mobile number.';
    if (!agreed) local.terms = 'Accept the terms to create an account.';
    setFields(local);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      const res = await post<{ verification: PendingVerification }>('/auth/register', {
        role,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      });
      savePending(res.verification);
      navigate('/verify', { state: res.verification });
    } catch (err) {
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes a minute. We'll verify your contact details with a one-time code."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <Form className="flex flex-col gap-5" onSubmit={onSubmit} validationBehavior="aria">
        <FormAlert message={error} />

        <RadioGroup value={role} onChange={(v) => setRole(v as Role)} name="role" className="gap-3">
          <Label>I want to</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(({ value, icon: Icon, title, text }) => (
              <Radio key={value} value={value} className="m-0">
                <Radio.Content className="group flex h-full w-full cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-white p-4 transition-colors data-[hovered=true]:border-foreground/30 data-[selected=true]:border-brand-black data-[selected=true]:bg-brand-yellow-soft data-[focus-visible=true]:ring-3 data-[focus-visible=true]:ring-brand-yellow/50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary group-data-[selected=true]:bg-brand-yellow">
                    <Icon className="size-5 text-brand-black" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">{title}</span>
                    <Description className="text-xs">{text}</Description>
                  </span>
                  <Radio.Control className="sr-only">
                    <Radio.Indicator />
                  </Radio.Control>
                </Radio.Content>
              </Radio>
            ))}
          </div>
        </RadioGroup>

        <TextInput
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={fields.email}
          description="We'll send your verification code here."
        />
        <TextInput
          label="Mobile number"
          name="phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          inputMode="tel"
          placeholder="98765 43210"
          error={fields.phone}
          description={email.trim() ? 'Optional. You can verify it later.' : 'Used for verification if you skip email.'}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fields.password}
          description="At least 8 characters, with a letter and a number."
        />

        <div className="flex flex-col gap-1">
          <Checkbox isSelected={agreed} onChange={setAgreed} isInvalid={!!fields.terms} name="terms">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-sm">I agree to the DriveThrough terms of service and privacy policy.</span>
            </Checkbox.Content>
          </Checkbox>
          {fields.terms ? <p className="text-xs text-danger">{fields.terms}</p> : null}
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth isPending={pending}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Creating account…' : 'Create account'}
            </>
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
}
