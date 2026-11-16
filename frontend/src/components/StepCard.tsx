import type { ReactNode } from 'react';

/** Card wrapper for a single onboarding step (design.md §7 cards: white, 1px border, 14px radius). */
export function StepCard({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-border bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.06)] sm:p-8">
      <h1 className="text-[22px] leading-tight font-bold text-brand-black sm:text-[28px]">{title}</h1>
      {description ? <p className="mt-2 text-sm text-muted sm:text-base">{description}</p> : null}
      <div className="mt-6 flex flex-col gap-5">{children}</div>
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">{actions}</div>
    </section>
  );
}
