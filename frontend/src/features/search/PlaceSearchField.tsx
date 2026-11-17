import { useEffect, useRef, useState } from 'react';
import type { Key } from '@heroui/react';
import { ComboBox, Description, FieldError, Input, Label, ListBox, Spinner } from '@heroui/react';
import { MapPin } from 'lucide-react';
import { errorMessage, get } from '../../lib/api';
import type { PlaceSuggestion } from './types';

/**
 * Location autocomplete (Feature 05 MAP-001). Suggestions come from Uber via our backend proxy — the
 * maps credentials never reach the browser. Only a chosen suggestion counts as a location; typed text
 * alone is never treated as a confirmed place (design.md §7 "Selects and autocomplete").
 */
export function PlaceSearchField({ label, context, value, onChange, error }: {
  label: string;
  context: 'origin' | 'destination';
  value: PlaceSuggestion | null;
  onChange: (place: PlaceSuggestion | null) => void;
  error?: string;
}) {
  const [input, setInput] = useState(value?.address ?? '');
  const [items, setItems] = useState<PlaceSuggestion[]>(value ? [value] : []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || q === value?.name || q === value?.address) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ suggestions: PlaceSuggestion[] }>(`/locations/suggestions?q=${encodeURIComponent(q)}&context=${context}`);
        if (id === seq.current) {
          setItems(res.suggestions);
          setLoadError(null);
        }
      } catch (e) {
        if (id === seq.current) setLoadError(errorMessage(e));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, context, value]);

  return (
    <ComboBox
      fullWidth
      inputValue={input}
      onInputChange={(v: string) => {
        setInput(v);
        if (value && v !== value.name) onChange(null);
      }}
      selectedKey={value?.id ?? null}
      onSelectionChange={(key: Key | null) => {
        const place = items.find((p) => p.id === key) ?? null;
        onChange(place);
        if (place) setInput(place.name);
      }}
      items={items}
      defaultFilter={() => true}
      menuTrigger="input"
      allowsEmptyCollection
      isInvalid={!!error || !!loadError}
      isRequired
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <MapPin className="ml-3 size-4 shrink-0 text-muted" aria-hidden />
        <Input placeholder="Search for an address or place" />
        {loading ? <Spinner size="sm" className="mr-3" /> : null}
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => <p className="p-3 text-sm text-muted">{loading ? 'Searching…' : 'No matching places. Try a nearby landmark or area.'}</p>}>
          {(p: PlaceSuggestion) => (
            <ListBox.Item id={p.id} textValue={p.name}>
              <span className="flex flex-col">
                <span className="font-semibold">{p.name}</span>
                {p.address !== p.name ? <span className="text-xs text-muted">{p.address}</span> : null}
              </span>
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
      {error || loadError ? <FieldError>{error ?? loadError}</FieldError> : value ? <Description>{value.address}</Description> : null}
    </ComboBox>
  );
}
