import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, Form, Spinner } from '@heroui/react';
import { AuthLayout } from '../../components/AuthLayout';
import { FormAlert } from '../../components/FormAlert';
import { PasswordField } from '../../components/PasswordField';
import { TextInput } from '../../components/TextInput';
import { ApiError, errorMessage } from '../../lib/api';
import { homePathFor, useAuth } from './auth-context';
import { savePending, type PendingVerification } from './pending';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setFields({});
    setPending(true);
    try {
      const user = await login(identifier, password);
      const from = state?.from && !state.from.startsWith('/login') ? state.from : null;
      navigate(user.onboarding.completed && from ? from : homePathFor(user), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERIFICATION_REQUIRED') {
        const v = (err.details as { verification: PendingVerification }).verification;
        savePending(v);
        navigate('/verify', { state: { ...v, notice: err.message } });
        return;
      }
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to book a driver or manage your trips."
      footer={
        <>
          New to DriveThrough?{' '}
          <Link to="/signup" className="font-semibold text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <Form className="flex flex-col gap-5" onSubmit={onSubmit} validationBehavior="aria">
        <FormAlert message={state?.notice} status="success" />
        <FormAlert message={error} />
        <TextInput
          label="Email or mobile number"
          name="identifier"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          placeholder="you@example.com or 98765 43210"
          error={fields.identifier}
          isRequired
        />
        <div className="flex flex-col gap-2">
          <PasswordField value={password} onChange={setPassword} error={fields.password} />
          <Link to="/forgot-password" className="self-end text-sm font-semibold text-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth isPending={pending}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Signing in…' : 'Sign in'}
            </>
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
}
