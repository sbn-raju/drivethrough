import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Form, Spinner } from '@heroui/react';
import { AuthLayout } from '../../components/AuthLayout';
import { FormAlert } from '../../components/FormAlert';
import { TextInput } from '../../components/TextInput';
import { ApiError, errorMessage, post } from '../../lib/api';
import type { PendingVerification } from './pending';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setFieldError(undefined);
    try {
      const res = await post<{ verification: PendingVerification }>('/auth/forgot-password', { identifier });
      navigate('/reset-password', { state: res.verification });
    } catch (err) {
      if (err instanceof ApiError) setFieldError(err.fields.identifier);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email or mobile number on your account. If it matches, we'll send you a code."
      footer={
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <Form className="flex flex-col gap-5" onSubmit={onSubmit} validationBehavior="aria">
        <FormAlert message={error} />
        <TextInput
          label="Email or mobile number"
          name="identifier"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          error={fieldError}
          isRequired
        />
        <Button type="submit" variant="primary" size="lg" fullWidth isPending={pending}>
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              Send reset code
            </>
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
}
