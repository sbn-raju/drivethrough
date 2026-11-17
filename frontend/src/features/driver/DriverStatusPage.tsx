import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Chip } from '@heroui/react';
import { CalendarClock, CircleCheck, FileText, Hourglass, IndianRupee, TriangleAlert } from 'lucide-react';
import { AccountCard } from '../../components/AccountCard';
import { AppShell } from '../../components/AppShell';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { FullPageSpinner } from '../auth/guards';
import { errorMessage, get } from '../../lib/api';
import { IDENTITY_DOCUMENTS } from '../../lib/constants';
import { APPROVAL_LABELS, EDITABLE_STATUSES, type DriverOnboarding } from './types';

const DOC_STATUS: Record<string, string> = {
  submitted: 'Submitted',
  pending_review: 'Under review',
  needs_resubmission: 'Action required',
  approved: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

export function DriverStatusPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DriverOnboarding | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<DriverOnboarding>('/drivers/me/onboarding').then(setData).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <AppShell><FormAlert message={error} /></AppShell>;
  if (!data) return <FullPageSpinner />;
  if (data.profile.approvalStatus === 'not_submitted') return <Navigate to="/onboarding/driver" replace />;

  const status = data.profile.approvalStatus;
  const chip = APPROVAL_LABELS[status];
  const firstName = data.profile.fullName?.split(' ')[0];
  const needsAction = EDITABLE_STATUSES.includes(status);

  const copy: Record<string, { icon: typeof Hourglass; title: string; body: string }> = {
    pending_review: {
      icon: Hourglass,
      title: 'Driver verification in progress',
      body: "We're reviewing your licence and identity documents. We'll notify you when the review is complete. You won't appear in customer searches until you're verified.",
    },
    approved: { icon: CircleCheck, title: 'Driver verification completed', body: 'Set your states, rates and availability, then turn on "Available for bookings" to appear in customer searches.' },
    needs_resubmission: { icon: TriangleAlert, title: 'Action required', body: 'Some details need correcting. Review the notes below, update your profile and submit it again.' },
    rejected: { icon: TriangleAlert, title: 'Verification was not approved', body: 'Review the reason below. You can update your details and submit again, or contact support.' },
    expired: { icon: TriangleAlert, title: 'A document has expired', body: 'Upload a valid document to keep receiving trip requests.' },
    suspended: { icon: TriangleAlert, title: 'Account suspended', body: "You can't accept trips while your account is suspended. Contact support for help." },
  };
  const c = copy[status] ?? copy.pending_review;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm font-semibold text-muted">Driver dashboard</p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold text-brand-black sm:text-4xl">{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>
        </div>

        <section className="rounded-[14px] border border-border bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <c.icon className="size-5" aria-hidden /> {c.title}
            </h2>
            <Chip color={chip.color}>{chip.label}</Chip>
          </div>
          <p className="mt-2 text-sm text-muted">{c.body}</p>
          {data.profile.reviewReason && <div className="mt-4"><FormAlert status="warning" title="Reviewer note" message={data.profile.reviewReason} /></div>}

          <ul className="mt-5 flex flex-col divide-y divide-border rounded-[10px] border border-border">
            {data.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <FileText className="size-4 text-muted" aria-hidden />
                <span className="flex-1 font-semibold">
                  {d.documentType === 'driving_licence'
                    ? 'Driving licence'
                    : IDENTITY_DOCUMENTS.find((x) => x.id === d.documentSubtype)?.name ?? 'Identity document'}
                  {d.documentNumberLast4 ? <span className="font-normal text-muted"> · ending {d.documentNumberLast4}</span> : null}
                </span>
                {d.isSynthetic && <Chip size="sm" color="warning">Synthetic (test)</Chip>}
                <Chip size="sm" color={d.verificationStatus === 'approved' ? 'success' : d.verificationStatus === 'needs_resubmission' || d.verificationStatus === 'rejected' ? 'warning' : 'default'}>
                  {DOC_STATUS[d.verificationStatus]}
                </Chip>
              </li>
            ))}
          </ul>

          {needsAction && (
            <div className="mt-5">
              <PendingButton pending={false} onPress={() => navigate('/onboarding/driver')}>
                Update and resubmit
              </PendingButton>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: IndianRupee, title: 'Rates and preferences', text: 'Hourly rate, minimum hours, trip and vehicle types, operating states.' },
            { icon: CalendarClock, title: 'Availability', text: 'Your weekly hours and whether you are taking bookings.' },
          ].map(({ icon: Icon, title, text }) => (
            <Link key={title} to="/driver/settings" className="rounded-[14px] border border-border bg-white p-5 transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-brand-yellow/50 focus-visible:outline-none">
              <Icon className="size-5" aria-hidden />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="text-sm text-muted">{text}</p>
              <p className="mt-3 text-xs font-semibold">{status === 'approved' ? 'Manage' : 'Set up now — customers see you once verified'}</p>
            </Link>
          ))}
        </section>

        <AccountCard />
      </div>
    </AppShell>
  );
}
