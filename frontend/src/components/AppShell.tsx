import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@heroui/react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { Logo } from './Logo';

export function AppShell({ children, width = 'max-w-3xl' }: { children: ReactNode; width?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const contact = user?.email ?? user?.phone ?? '';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo className="h-7 sm:h-8" linkTo="/" />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-muted sm:inline">{user?.onboarding.fullName ?? contact}</span>
            <Button
              variant="outline"
              size="sm"
              isPending={signingOut}
              onPress={async () => {
                setSigningOut(true);
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full ${width} px-4 py-8 sm:px-6 sm:py-12`}>{children}</main>
    </div>
  );
}
