import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Label, Switch } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { TextInput } from '../../components/TextInput';
import { FullPageSpinner } from '../auth/guards';
import { ApiError, errorMessage, get, put } from '../../lib/api';
import { VEHICLE_TYPES } from '../../lib/constants';
import { CheckboxChips } from './CheckboxChips';

/**
 * Feature 04 (matching subset): bookable toggle, operating states, trip/vehicle preferences, rate card and
 * weekly availability. Blocked dates, waiting rate and city-level areas are the rest of Feature 04.
 */

type Window = { dayOfWeek: number; startMinute: number; endMinute: number };
type Settings = {
  isBookable: boolean;
  bookableBlockers: { key: string; label: string }[];
  preferences: { tripTypes: string[]; vehicleTypes: string[]; transmissions: string[] };
  rateCard: { currency: string; hourlyRate: number; minimumBillableHours: number; effectiveFrom: string } | null;
  availability: { timeZone: string; windows: Window[] };
  serviceAreas: { stateCode: string; name: string }[];
  limits: { hourlyRateMin: number; hourlyRateMax: number; minimumHoursMin: number; minimumHoursMax: number };
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first
const toHHMM = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

type DayRow = { on: boolean; start: string; end: string };
const rowsFrom = (windows: Window[]): DayRow[] =>
  DAYS.map((_, d) => {
    const w = windows.find((x) => x.dayOfWeek === d);
    return w ? { on: true, start: toHHMM(w.startMinute), end: toHHMM(w.endMinute) } : { on: false, start: '06:00', end: '22:00' };
  });

export function DriverSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [states, setStates] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([get<Settings>('/drivers/me/settings'), get<{ states: { code: string; name: string; isEnabled: boolean }[] }>('/reference/states')])
      .then(([s, r]) => {
        setSettings(s);
        setStates(r.states.filter((x) => x.isEnabled).map((x) => ({ id: x.code, name: x.name })));
      })
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  if (loadError) return <AppShell><FormAlert message={loadError} /></AppShell>;
  if (!settings) return <FullPageSpinner />;

  return (
    <AppShell>
      <Link to="/driver" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Driver dashboard
      </Link>
      <h1 className="mt-3 text-[28px] leading-tight font-bold text-brand-black sm:text-4xl">Trips, rates and availability</h1>
      <p className="mt-2 text-muted">Customers only see you when every item below is set and you're available for bookings.</p>

      <div className="mt-6 flex flex-col gap-5">
        <BookableCard settings={settings} onSaved={setSettings} />
        <StatesCard settings={settings} options={states} onSaved={setSettings} />
        <PreferencesCard settings={settings} onSaved={setSettings} />
        <RateCard settings={settings} onSaved={setSettings} />
        <AvailabilityCard settings={settings} onSaved={setSettings} />
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-border bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function useSave(onSaved: (s: Settings) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const save = async (fn: () => Promise<Settings>) => {
    setPending(true);
    setError(null);
    setFields({});
    setSaved(false);
    try {
      onSaved(await fn());
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setFields(e.fields);
      setError(e instanceof ApiError && Object.keys(e.fields).length ? Object.values(e.fields)[0] : errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return { pending, error, fields, saved, save };
}

function BookableCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const { pending, error, save } = useSave(onSaved);
  const ready = settings.bookableBlockers.length === 0;
  return (
    <section className={`rounded-[14px] border p-5 sm:p-6 ${settings.isBookable ? 'border-brand-black bg-brand-yellow-soft' : 'border-border bg-white'}`}>
      <Switch
        isSelected={settings.isBookable}
        isDisabled={pending || (!ready && !settings.isBookable)}
        onChange={(isBookable: boolean) => save(() => put<Settings>('/drivers/me/bookable-status', { isBookable }))}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          <Label className="text-base font-bold">Available for bookings</Label>
        </Switch.Content>
      </Switch>
      <p className="mt-2 text-sm text-muted">
        {settings.isBookable
          ? 'Customers can find you for trips that fit your states, preferences and schedule.'
          : ready
            ? 'Turn this on to appear in customer searches.'
            : 'Finish these first:'}
      </p>
      {!ready && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {settings.bookableBlockers.map((b) => <li key={b.key}>{b.label}</li>)}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Turning this off stops new requests. It does not cancel trips you've already accepted.</p>
      <div className="mt-3"><FormAlert message={error} /></div>
    </section>
  );
}

function StatesCard({ settings, options, onSaved }: { settings: Settings; options: { id: string; name: string }[]; onSaved: (s: Settings) => void }) {
  const [value, setValue] = useState(settings.serviceAreas.map((a) => a.stateCode));
  const { pending, error, saved, save } = useSave(onSaved);
  return (
    <Card title="Operating states" description="For an interstate trip you must operate in every state the route passes through.">
      <CheckboxChips label="States" options={options} value={value} onChange={setValue} columns />
      <FormAlert message={error} />
      <SaveRow pending={pending} saved={saved} onPress={() => save(async () => {
        await put('/drivers/me/service-areas', { stateCodes: value });
        return get<Settings>('/drivers/me/settings');
      })} />
    </Card>
  );
}

function PreferencesCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [tripTypes, setTripTypes] = useState(settings.preferences.tripTypes);
  const [vehicleTypes, setVehicleTypes] = useState(settings.preferences.vehicleTypes);
  const [transmissions, setTransmissions] = useState(settings.preferences.transmissions);
  const { pending, error, fields, saved, save } = useSave(onSaved);
  return (
    <Card title="Trip and vehicle preferences">
      <CheckboxChips label="Trip types" options={[{ id: 'one_way', name: 'One-way' }, { id: 'round_trip', name: 'Round-trip' }]} value={tripTypes} onChange={setTripTypes} error={fields.tripTypes} />
      <CheckboxChips label="Vehicle types" options={VEHICLE_TYPES} value={vehicleTypes} onChange={setVehicleTypes} error={fields.vehicleTypes} />
      <CheckboxChips label="Transmission" options={[{ id: 'manual', name: 'Manual' }, { id: 'automatic', name: 'Automatic' }]} value={transmissions} onChange={setTransmissions} error={fields.transmissions} />
      <FormAlert message={error} />
      <SaveRow pending={pending} saved={saved} onPress={() => save(() => put<Settings>('/drivers/me/preferences', { tripTypes, vehicleTypes, transmissions }))} />
    </Card>
  );
}

function RateCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const { limits } = settings;
  const [hourlyRate, setHourlyRate] = useState(settings.rateCard ? String(settings.rateCard.hourlyRate) : '');
  const [minHours, setMinHours] = useState(settings.rateCard ? String(settings.rateCard.minimumBillableHours) : String(limits.minimumHoursMin));
  const { pending, error, fields, saved, save } = useSave(onSaved);
  return (
    <Card title="Rates" description="A rate change applies to new fare quotes only. Quotes customers already have are not changed.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Hourly rate (₹)" name="hourlyRate" type="number" inputMode="numeric" value={hourlyRate} onChange={setHourlyRate} min={String(limits.hourlyRateMin)} max={String(limits.hourlyRateMax)} description={`Between ₹${limits.hourlyRateMin} and ₹${limits.hourlyRateMax}`} error={fields.hourlyRate} isRequired />
        <TextInput label="Minimum billable hours" name="minimumBillableHours" type="number" inputMode="numeric" value={minHours} onChange={setMinHours} min={String(limits.minimumHoursMin)} max={String(limits.minimumHoursMax)} description={`Between ${limits.minimumHoursMin} and ${limits.minimumHoursMax} hours`} error={fields.minimumBillableHours} isRequired />
      </div>
      <FormAlert message={error} />
      <SaveRow pending={pending} saved={saved} onPress={() => save(() => put<Settings>('/drivers/me/rate-card', { hourlyRate: Number(hourlyRate), minimumBillableHours: Number(minHours) }))} />
    </Card>
  );
}

function AvailabilityCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [rows, setRows] = useState<DayRow[]>(rowsFrom(settings.availability.windows));
  const { pending, error, saved, save } = useSave(onSaved);
  const update = (d: number, patch: Partial<DayRow>) => setRows((r) => r.map((row, i) => (i === d ? { ...row, ...patch } : row)));

  const windows = rows.flatMap((r, d) => {
    if (!r.on) return [];
    const start = toMinutes(r.start);
    const endRaw = toMinutes(r.end);
    return [{ dayOfWeek: d, startMinute: start, endMinute: endRaw === 0 ? 1440 : endRaw }];
  });

  return (
    <Card title="Weekly availability" description="Times are in India Standard Time. Use 00:00 as the end time for midnight. A trip must fit entirely inside your hours, including travel to pickup.">
      <button type="button" className="self-start text-sm font-semibold underline underline-offset-4" onClick={() => setRows(DAYS.map(() => ({ on: true, start: '06:00', end: '22:00' })))}>
        Set every day 06:00–22:00
      </button>
      <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
        {ORDER.map((d) => (
          <li key={d} className="flex flex-wrap items-center gap-3 p-3">
            <Switch isSelected={rows[d].on} onChange={(on: boolean) => update(d, { on })} className="w-36">
              <Switch.Control><Switch.Thumb /></Switch.Control>
              <Switch.Content><Label>{DAYS[d]}</Label></Switch.Content>
            </Switch>
            {rows[d].on ? (
              <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-xs">
                <TextInput label="From" name={`start-${d}`} type="time" value={rows[d].start} onChange={(v) => update(d, { start: v })} />
                <TextInput label="To" name={`end-${d}`} type="time" value={rows[d].end} onChange={(v) => update(d, { end: v })} />
              </div>
            ) : (
              <span className="text-sm text-muted">Unavailable</span>
            )}
          </li>
        ))}
      </ul>
      <FormAlert message={error} />
      <SaveRow pending={pending} saved={saved} onPress={() => save(() => put<Settings>('/drivers/me/availability', { windows }))} />
    </Card>
  );
}

function SaveRow({ pending, saved, onPress }: { pending: boolean; saved: boolean; onPress: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <PendingButton pending={pending} pendingLabel="Saving…" onPress={onPress} variant="secondary">Save</PendingButton>
      {saved && !pending ? <span role="status" className="text-sm text-success">Saved</span> : null}
    </div>
  );
}
