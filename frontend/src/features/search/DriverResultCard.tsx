import { Chip } from '@heroui/react';
import { BadgeCheck, CalendarCheck, Languages, UserRound } from 'lucide-react';
import { formatRupees, type DriverResult } from './types';

/**
 * Driver result card (Feature 06 §6, design.md §8). Shows a verification indicator only — never document
 * numbers or images. The fare quote (with return compensation and platform fee) arrives with Feature 07.
 */
export function DriverResultCard({ driver }: { driver: DriverResult }) {
  return (
    <article className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-5 sm:flex-row sm:items-start">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary">
        {driver.photoUrl ? (
          <img src={driver.photoUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserRound className="size-7 text-muted" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold">{driver.displayName}</h3>
          <Chip size="sm" color="success"><BadgeCheck className="size-3.5" aria-hidden /> Verified</Chip>
        </div>
        <p className="text-sm text-muted">
          {driver.experienceYears} {driver.experienceYears === 1 ? 'year' : 'years'} driving experience ·{' '}
          {driver.reviewCount ? `${driver.rating?.toFixed(1)} (${driver.reviewCount} reviews)` : 'New on DriveThrough'}
        </p>
        {driver.languages.length > 0 && (
          <p className="flex items-center gap-2 text-sm"><Languages className="size-4 text-muted" aria-hidden /> {driver.languages.join(', ')}</p>
        )}
        <p className="flex items-center gap-2 text-sm"><CalendarCheck className="size-4 text-muted" aria-hidden /> Available for your full trip time</p>
        <div className="flex flex-wrap gap-1.5">
          {driver.coverage.map((s) => <Chip key={s.code} size="sm">{s.name}</Chip>)}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t border-border pt-3 sm:items-end sm:border-t-0 sm:pt-0 sm:text-right">
        <p className="text-xl font-bold tabular">{formatRupees(driver.rate.hourlyRate)}<span className="text-sm font-normal text-muted"> / hour</span></p>
        <p className="text-xs text-muted">Minimum {driver.rate.minimumBillableHours} hours</p>
        <p className="mt-1 text-xs text-muted">You'll see the full fare before you request.</p>
      </div>
    </article>
  );
}
