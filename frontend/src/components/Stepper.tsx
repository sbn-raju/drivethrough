import { Check } from 'lucide-react';

export type Step = { key: string; label: string; complete?: boolean };

/** Horizontal progress indicator. Steps are buttons so users can revisit completed ones. */
export function Stepper({ steps, current, onSelect }: { steps: Step[]; current: number; onSelect?: (index: number) => void }) {
  return (
    <nav aria-label="Setup progress" className="mb-8">
      <p className="mb-3 text-sm font-semibold text-muted">
        Step <span className="tabular">{current + 1}</span> of <span className="tabular">{steps.length}</span>
        <span className="text-foreground"> · {steps[current].label}</span>
      </p>
      <ol className="flex gap-1.5">
        {steps.map((s, i) => {
          const state = i === current ? 'current' : s.complete ? 'done' : 'todo';
          const reachable = !!onSelect && (s.complete || i <= current || steps.slice(0, i).every((p) => p.complete));
          return (
            <li key={s.key} className="flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect?.(i)}
                aria-current={i === current ? 'step' : undefined}
                aria-label={`${s.label}${s.complete ? ' (completed)' : ''}`}
                className="group flex w-full flex-col gap-2 rounded-md text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow/50 disabled:cursor-default"
              >
                <span
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    state === 'current' ? 'bg-brand-black' : state === 'done' ? 'bg-brand-yellow' : 'bg-border'
                  }`}
                />
                <span className="hidden items-center gap-1 text-xs font-semibold text-muted md:flex">
                  {s.complete ? <Check className="size-3.5 text-success" aria-hidden /> : null}
                  <span className={state === 'current' ? 'text-foreground' : ''}>{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
