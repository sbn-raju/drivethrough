import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button, Form, Label, Spinner } from '@heroui/react';
import { AuthLayout } from '../../components/AuthLayout';
import { FormAlert } from '../../components/FormAlert';
import { PasswordField } from '../../components/PasswordField';
import { ApiError, errorMessage, post } from '../../lib/api';
import { OtpInput } from './OtpInput';
import type { PendingVerification } from './pending';
import { useCountdown } from './useCountdown';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = location.state as PendingVerification | null;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { left, restart } = useCountdown();

  if (!target?.identifier) return <Navigate to="/forgot-password" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (code.length !== 6) local.code = 'Enter the 6-digit code.';
    if (password !== confirm) local.confirm = 'Passwords do not match.';
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      const res = await post<{ message: string }>('/auth/reset-password', { identifier: target!.identifier, code, newPassword: password });
      navigate('/login', { replace: true, state: { notice: res.message } });
    } catch (err) {
      if (err instanceof ApiError) setFields({ ...err.fields, ...(err.fields.newPassword ? { password: err.fields.newPassword } : {}) });
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    try {
      await post('/auth/resend-otp', { identifier: target!.identifier, purpose: 'password_reset' });
      setInfo(`If an account matches, a new code is on its way to ${target!.destination}.`);
      restart();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={
        <>
          If an account matches <span className="font-semibold text-foreground">{target.destination}</span>, we sent it a 6-digit code.
        </>
      }
      footer={
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <Form className="flex flex-col gap-5" onSubmit={onSubmit} validationBehavior="aria">
        <FormAlert message={info} status="success" />
        <FormAlert message={error} />
        <div className="flex flex-col gap-2">
          <Label>Reset code</Label>
          <OtpInput value={code} onChange={setCode} isInvalid={!!fields.code} />
          {fields.code ? <p className="text-xs text-danger">{fields.code}</p> : null}
          <p className="text-sm text-muted" aria-live="polite">
            {left > 0 ? (
              <span className="tabular">Request another code in {left}s.</span>
            ) : (
              <button type="button" onClick={resend} className="font-semibold text-foreground underline underline-offset-4">
                Send a new code
              </button>
            )}
          </p>
        </div>
        <PasswordField label="New password" name="newPassword" value={password} onChange={setPassword} autoComplete="new-password" error={fields.password} description="At least 8 characters, with a letter and a number." />
        <PasswordField label="Confirm new password" name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" error={fields.confirm} />
        <p className="text-xs text-muted">Resetting your password signs you out on every device.</p>
        <Button type="submit" variant="primary" size="lg" fullWidth isPending={pending}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              Reset password
            </>
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
}
