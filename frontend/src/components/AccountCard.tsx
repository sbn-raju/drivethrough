import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Chip } from '@heroui/react';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { PendingButton } from './PendingButton';

/** Contact details + "sign out everywhere" (AUTH-006). */
export function AccountCard() {
  const { user, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  if (!user) return null;

  const rows = [
    user.email && { icon: Mail, value: user.email, verified: user.emailVerified },
    user.phone && { icon: Phone, value: user.phone, verified: user.phoneVerified },
  ].filter(Boolean) as { icon: typeof Mail; value: string; verified: boolean }[];

  return (
    <section className="rounded-[14px] border border-border bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ShieldCheck className="size-5" aria-hidden /> Account and security
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map(({ icon: Icon, value, verified }) => (
          <li key={value} className="flex flex-wrap items-center gap-2 text-sm">
            <Icon className="size-4 text-muted" aria-hidden />
            <span className="font-semibold break-all">{value}</span>
            <Chip size="sm" color={verified ? 'success' : 'warning'}>
              {verified ? 'Verified' : 'Not verified'}
            </Chip>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Signed in on a shared or lost device?</p>
        <PendingButton
          variant="outline"
          pending={pending}
          pendingLabel="Signing out…"
          onPress={async () => {
            setPending(true);
            await logoutAll();
            navigate('/login', { replace: true, state: { notice: 'You have been signed out on all devices.' } });
          }}
        >
          Sign out of all devices
        </PendingButton>
      </div>
    </section>
  );
}
