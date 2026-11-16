import { createContext, useContext } from 'react';
import type { AuthPayload, User } from '../../lib/api';

export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: User | null;
  /** Store a freshly issued session (after login or OTP verification). */
  acceptSession: (payload: AuthPayload) => void;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  reloadUser: () => Promise<User | null>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where a signed-in user should land based on role and onboarding progress. */
export function homePathFor(user: User): string {
  if (user.role === 'consumer') return user.onboarding.completed ? '/app' : '/onboarding/consumer';
  if (user.role === 'driver') return user.onboarding.completed ? '/driver' : '/onboarding/driver';
  return '/app';
}
