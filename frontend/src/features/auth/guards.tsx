import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Spinner } from '@heroui/react';
import type { User } from '../../lib/api';
import { homePathFor, useAuth } from './auth-context';

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <Spinner size="lg" color="current" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Pages for signed-out visitors (login, sign-up). Signed-in users are sent to their home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (user) return <Navigate to={homePathFor(user)} replace />;
  return <>{children}</>;
}

/** Role-based screen access (AUTH-005). The API enforces the same rules server-side. */
export function RequireRole({ roles, children }: { roles: User['role'][]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return <>{children}</>;
}

export function RootRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}
