import { Checkbox, CheckboxGroup, Description, Label } from '@heroui/react';

/** Multi-select rendered as a wrap of toggleable chips — used for languages, licence classes and states. */
export function CheckboxChips({ label, description, options, value, onChange, error, columns }: {
  label: string;
  description?: string;
  options: { id: string; name: string; description?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
  columns?: boolean;
}) {
  return (
    <CheckboxGroup value={value} onChange={onChange} isInvalid={!!error} className="gap-2">
      <Label>{label}</Label>
      {description ? <Description>{description}</Description> : null}
      <div className={columns ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-wrap gap-2'}>
        {options.map((o) => (
          <Checkbox key={o.id} value={o.id} className="m-0">
            <Checkbox.Content className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-white px-3 py-2 text-sm transition-colors data-[hovered=true]:border-foreground/30 data-[selected=true]:border-brand-black data-[selected=true]:bg-brand-yellow-soft data-[focus-visible=true]:ring-3 data-[focus-visible=true]:ring-brand-yellow/50">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="flex flex-col">
                <span className="font-semibold">{o.name}</span>
                {o.description ? <span className="text-xs text-muted">{o.description}</span> : null}
              </span>
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </CheckboxGroup>
  );
}
