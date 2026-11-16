/**
 * Thin API client.
 * - Access token lives in memory only (never localStorage).
 * - Refresh token is an httpOnly cookie scoped to /api/v1/auth; on 401 we refresh once and retry.
 * - Concurrent 401s share a single in-flight refresh so rotation isn't mistaken for token reuse.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';
const CSRF_HEADER = { 'X-Requested-With': 'drivethrough-web' };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly details: unknown;

  constructor(status: number, body: { error?: { code?: string; message?: string; fields?: Record<string, string>; details?: unknown } }) {
    super(body.error?.message ?? 'Something went wrong. Please try again.');
    this.status = status;
    this.code = body.error?.code ?? 'UNKNOWN';
    this.fields = body.error?.fields ?? {};
    this.details = body.error?.details;
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshInFlight: Promise<AuthPayload | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

export type OnboardingSummary =
  | { kind: 'consumer'; completed: boolean; fullName: string | null }
  | { kind: 'driver'; completed: boolean; fullName: string | null; approvalStatus: DriverApprovalStatus }
  | { kind: 'staff'; completed: true; fullName: null };

export type DriverApprovalStatus =
  | 'not_submitted'
  | 'pending_review'
  | 'needs_resubmission'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'suspended';

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'consumer' | 'driver' | 'admin' | 'super_admin';
  accountStatus: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
  emailVerified: boolean;
  phoneVerified: boolean;
  onboarding: OnboardingSummary;
};

export type AuthPayload = { accessToken: string; expiresIn: number; user: User };

async function parseBody(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: 'Unexpected response from the server.' } };
  }
}

async function rawRequest(method: string, path: string, body?: unknown, withAuth = true) {
  const headers: Record<string, string> = { ...CSRF_HEADER };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (withAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK', message: 'Cannot reach DriveThrough. Check your connection and try again.' } });
  }
  return { res, data: await parseBody(res) };
}

/** Exchanges the refresh cookie for a new access token. Returns null when there's no valid session. */
export function refreshSession(): Promise<AuthPayload | null> {
  refreshInFlight ??= (async () => {
    try {
      const { res, data } = await rawRequest('POST', '/auth/refresh', undefined, false);
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      setAccessToken((data as AuthPayload).accessToken);
      return data as AuthPayload;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/refresh', '/auth/logout'];

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let { res, data } = await rawRequest(method, path, body);

  if (res.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      ({ res, data } = await rawRequest(method, path, body));
    } else {
      onSessionLost?.();
    }
  }

  if (!res.ok) throw new ApiError(res.status, data ?? {});
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body);
export const patch = <T>(path: string, body?: unknown) => api<T>('PATCH', path, body);
export const put = <T>(path: string, body?: unknown) => api<T>('PUT', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);

/** Turns an unknown error into a message suitable for an inline alert. */
export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
