import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider } from './features/auth/AuthProvider';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { GuestOnly, RequireRole, RootRedirect } from './features/auth/guards';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SignupPage } from './features/auth/SignupPage';
import { VerifyPage } from './features/auth/VerifyPage';
import { ConsumerHomePage } from './features/consumer/ConsumerHomePage';
import { ConsumerOnboardingPage } from './features/consumer/ConsumerOnboardingPage';
import { DriverOnboardingPage } from './features/driver/DriverOnboardingPage';
import { DriverSettingsPage } from './features/driver/DriverSettingsPage';
import { DriverStatusPage } from './features/driver/DriverStatusPage';
import { FindDriverPage } from './features/search/FindDriverPage';
import { Logo } from './components/Logo';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
          <Route path="/verify" element={<GuestOnly><VerifyPage /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
          <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />

          <Route path="/onboarding/consumer" element={<RequireRole roles={['consumer']}><ConsumerOnboardingPage /></RequireRole>} />
          <Route path="/app" element={<RequireRole roles={['consumer', 'admin', 'super_admin']}><ConsumerHomePage /></RequireRole>} />

          <Route path="/trips/new" element={<RequireRole roles={['consumer']}><FindDriverPage /></RequireRole>} />

          <Route path="/onboarding/driver" element={<RequireRole roles={['driver']}><DriverOnboardingPage /></RequireRole>} />
          <Route path="/driver" element={<RequireRole roles={['driver']}><DriverStatusPage /></RequireRole>} />
          <Route path="/driver/settings" element={<RequireRole roles={['driver']}><DriverSettingsPage /></RequireRole>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <Logo className="h-10" />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="font-semibold underline underline-offset-4">Go to DriveThrough</Link>
    </div>
  );
}
