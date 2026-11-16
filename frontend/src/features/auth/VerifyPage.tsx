import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button, Spinner } from '@heroui/react';
import { AuthLayout } from '../../components/AuthLayout';
import { FormAlert } from '../../components/FormAlert';
import { ApiError, errorMessage, post, type AuthPayload } from '../../lib/api';
import { homePathFor, useAuth } from './auth-context';
import { OtpInput } from './OtpInput';
import { clearPending, loadPending } from './pending';
import { useCountdown } from './useCountdown';

export function VerifyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const pendingVerification = loadPending(location.state);
  const notice = (location.state as { notice?: string } | null)?.notice;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const { left, restart } = useCountdown();

  if (!pendingVerification) return <Navigate to="/signup" replace />;
  const { identifier, destination, channel } = pendingVerification;

  async function verify(value: string) {
    if (submitting || value.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = await post<AuthPayload>('/auth/verify-otp', { identifier, code: value });
      clearPending();
      acceptSession(payload);
      navigate(homePathFor(payload.user), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      await post('/auth/resend-otp', { identifier, purpose: 'signup' });
      setInfo(`We sent a new code to ${destination}.`);
      restart();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title={channel === 'email' ? 'Check your email' : 'Check your phone'}
      subtitle={
        <>
          Enter the 6-digit code we sent to <span className="font-semibold text-foreground">{destination}</span>. It expires in 10 minutes.
        </>
      }
      footer={
        <>
          Wrong {channel === 'email' ? 'email address' : 'mobile number'}?{' '}
          <Link to="/signup" className="font-semibold text-foreground underline underline-offset-4">
            Start again
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
      >
        <FormAlert message={info} status="success" />
        <FormAlert message={error} />
        <OtpInput value={code} onChange={setCode} onComplete={verify} isInvalid={!!error} isDisabled={submitting} />
        <Button type="submit" variant="primary" size="lg" fullWidth isPending={submitting} isDisabled={code.length !== 6}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Verifying…' : 'Verify and continue'}
            </>
          )}
        </Button>
        <p className="text-sm text-muted" aria-live="polite">
          Didn't get a code?{' '}
          {left > 0 ? (
            <span className="tabular">You can request another in {left}s.</span>
          ) : (
            <button type="button" onClick={resend} disabled={resending} className="font-semibold text-foreground underline underline-offset-4 disabled:opacity-50">
              {resending ? 'Sending…' : 'Send a new code'}
            </button>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
