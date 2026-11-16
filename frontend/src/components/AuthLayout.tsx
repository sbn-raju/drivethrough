import type { ReactNode } from 'react';
import { BadgeCheck, CarFront, Route } from 'lucide-react';
import { Logo } from './Logo';

const points = [
  { icon: CarFront, title: 'Your own vehicle', text: 'A professional driver drives your car — no rentals, no switching vehicles.' },
  { icon: BadgeCheck, title: 'Reviewed credentials', text: "Drivers' licences and identity documents are reviewed before they can take trips." },
  { icon: Route, title: 'One-way or round-trip', text: 'Clear trip details and fares before you book.' },
];

/** Split layout: brand panel on desktop, form on a white surface (the logo artwork has a white background). */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-black text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <RoadArt />
        <div className="relative max-w-md">
          <p className="text-sm font-semibold tracking-wide text-brand-yellow">DriveThrough</p>
          <h2 className="mt-4 text-4xl leading-tight font-bold">
            Your car. Your journey.
            <br />
            <span className="text-brand-yellow">A professional driver</span> when you need one.
          </h2>
        </div>
        <ul className="relative space-y-6">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon className="size-5 text-brand-yellow" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-white/70">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col bg-white px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <Logo className="h-9 sm:h-10" />
          <div className="flex flex-1 flex-col justify-center py-10">
            <h1 className="text-[28px] leading-tight font-bold text-brand-black sm:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-2 text-base text-muted">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
          </div>
          {footer ? <div className="border-t border-border pt-6 text-sm text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** Static geometric road motif — decorative only. */
function RoadArt() {
  return (
    <svg className="pointer-events-none absolute -right-24 bottom-0 h-[70%] w-auto opacity-25" viewBox="0 0 400 600" fill="none" aria-hidden>
      <path d="M380 0 C 300 180, 120 260, 60 600" stroke="currentColor" strokeWidth="90" className="text-white/20" />
      <path d="M380 0 C 300 180, 120 260, 60 600" stroke="var(--brand-yellow)" strokeWidth="6" strokeDasharray="28 22" />
    </svg>
  );
}
