import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, refreshSession, setAccessToken, setSessionLostHandler, type AuthPayload, type User } from '../../lib/api';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const acceptSession = useCallback((payload: AuthPayload) => {
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    setSessionLostHandler(clear);
    let cancelled = false;
    refreshSession().then((payload) => {
      if (cancelled) return;
      if (payload) acceptSession(payload);
      else clear();
    });
    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, [acceptSession, clear]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const payload = await post<AuthPayload>('/auth/login', { identifier, password });
      acceptSession(payload);
      return payload.user;
    },
    [acceptSession],
  );

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  const logoutAll = useCallback(async () => {
    try {
      await post('/auth/logout-all');
    } finally {
      clear();
    }
  }, [clear]);

  const reloadUser = useCallback(async () => {
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      setUser(user);
      return user;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, acceptSession, login, logout, logoutAll, reloadUser }),
    [status, user, acceptSession, login, logout, logoutAll, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
