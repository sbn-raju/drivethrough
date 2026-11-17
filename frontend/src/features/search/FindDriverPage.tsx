import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Key } from '@heroui/react';
import { Form, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { ArrowLeft, SearchX } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { SelectField } from '../../components/SelectField';
import { TextInput } from '../../components/TextInput';
import { ApiError, errorMessage, get, post } from '../../lib/api';
import { LANGUAGES, VEHICLE_TYPES } from '../../lib/constants';
import type { Vehicle } from '../consumer/types';
import { DriverResultCard } from './DriverResultCard';
import { PlaceSearchField } from './PlaceSearchField';
import { RouteSummary } from './RouteSummary';
import { formatIst, istIso, type PlaceSuggestion, type RouteEstimate, type SearchResponse, type TripType } from './types';

const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Feature 05 + 06 — plan a trip, check the route, find eligible drivers. All calculations happen on the server. */
export function FindDriverPage() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [pickup, setPickup] = useState<PlaceSuggestion | null>(null);
  const [drop, setDrop] = useState<PlaceSuggestion | null>(null);
  const [tripType, setTripType] = useState<TripType>('one_way');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get<{ vehicles: Vehicle[] }>('/consumers/me/vehicles')
      .then((r) => {
        const active = r.vehicles.filter((v) => v.status === 'active');
        setVehicles(active);
        if (active.length === 1) setVehicleId(active[0].id);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  // A changed pickup/drop invalidates the route estimate and any results (MAP-007).
  const changePlace = (which: 'pickup' | 'drop') => (place: PlaceSuggestion | null) => {
    const current = which === 'pickup' ? pickup : drop;
    if (place?.id === current?.id) return;
    (which === 'pickup' ? setPickup : setDrop)(place);
    setEstimate(null);
    setResult(null);
  };

  function validate() {
    const f: Record<string, string> = {};
    if (!pickup) f.pickupPlaceId = 'Choose a valid pickup location.';
    if (!drop) f.dropPlaceId = 'Choose a valid drop location.';
    if (pickup && drop && pickup.id === drop.id) f.dropPlaceId = 'Choose a destination different from your pickup.';
    if (!date) f.date = 'Choose a pickup date.';
    if (!time) f.time = 'Choose a pickup time.';
    if (tripType === 'round_trip') {
      if (!returnDate) f.returnDate = 'Select a return date for a round trip.';
      if (!returnTime) f.returnTime = 'Select a return time.';
    }
    if (!vehicleId) f.vehicleId = 'Choose a vehicle.';
    return f;
  }

  async function getEstimate(force = false) {
    const fresh = estimate && new Date(estimate.expiresAt).getTime() > Date.now() + 60_000;
    if (estimate && fresh && !force) return estimate;
    const r = await post<{ estimate: RouteEstimate }>('/routes/estimate', { pickupPlaceId: pickup!.id, dropPlaceId: drop!.id });
    setEstimate(r.estimate);
    return r.estimate;
  }

  async function onSubmit() {
    setError(null);
    const f = validate();
    setFields(f);
    if (Object.keys(f).length) return;

    setPending(true);
    try {
      const body = (routeEstimateId: string) => ({
        routeEstimateId,
        tripType,
        pickupAt: istIso(date, time),
        returnAt: tripType === 'round_trip' ? istIso(returnDate, returnTime) : null,
        vehicleId,
        language,
      });
      let est = await getEstimate();
      let res: SearchResponse;
      try {
        res = await post<SearchResponse>('/search/drivers', body(est.id));
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'ROUTE_ESTIMATE_EXPIRED')) throw e;
        est = await getEstimate(true);
        res = await post<SearchResponse>('/search/drivers', body(est.id));
      }
      setEstimate(res.route);
      setResult(res);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      if (e instanceof ApiError) {
        const field = (e.details as { field?: string } | undefined)?.field;
        const mapped: Record<string, string> = { ...e.fields };
        if (field === 'pickupAt') mapped.time = e.message;
        else if (field === 'returnAt') mapped.returnTime = e.message;
        else if (field) mapped[field] = e.message;
        setFields(mapped);
        if (!field) setError(e.message);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setPending(false);
    }
  }

  if (vehicles && vehicles.length === 0) {
    return (
      <AppShell>
        <BackLink />
        <section className="mt-4 rounded-[14px] border border-border bg-white p-6">
          <h1 className="text-2xl font-bold">Add your vehicle first</h1>
          <p className="mt-2 text-sm text-muted">A driver needs to know which car they'll be driving. Add it to your profile, then come back to find a driver.</p>
          <Link to="/app" className="mt-4 inline-block font-semibold underline underline-offset-4">Go to my vehicles</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell width="max-w-5xl">
      <BackLink />
      <h1 className="mt-3 text-[28px] leading-tight font-bold text-brand-black sm:text-4xl">Find a driver</h1>
      <p className="mt-2 text-muted">A professional driver for your own car, one-way or round-trip.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Form
          className="flex flex-col gap-5 self-start rounded-[14px] border border-border bg-white p-5 sm:p-6"
          validationBehavior="aria"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <PlaceSearchField label="Pickup location" context="origin" value={pickup} onChange={changePlace('pickup')} error={fields.pickupPlaceId} />
          <PlaceSearchField label="Drop location" context="destination" value={drop} onChange={changePlace('drop')} error={fields.dropPlaceId} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Trip type</span>
            <ToggleButtonGroup
              aria-label="Trip type"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([tripType])}
              onSelectionChange={(keys: Set<Key>) => {
                const [k] = [...keys];
                if (k) setTripType(k as TripType);
                setResult(null);
              }}
              className="w-full"
            >
              <ToggleButton id="one_way" className="flex-1">One-way</ToggleButton>
              <ToggleButton id="round_trip" className="flex-1"><ToggleButtonGroup.Separator />Round-trip</ToggleButton>
            </ToggleButtonGroup>
            <p className="text-xs text-muted">
              {tripType === 'one_way'
                ? "The driver takes your car to the destination. Any charge for the driver's own return journey is shown in the fare before you request."
                : 'The driver drives you there and back in your car. Return and any waiting charges are shown in the fare before you request.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Pickup date" name="date" type="date" value={date} onChange={setDate} min={todayIst()} error={fields.date} isRequired />
            <TextInput label="Pickup time" name="time" type="time" value={time} onChange={setTime} error={fields.time} isRequired />
          </div>
          {tripType === 'round_trip' && (
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Return date" name="returnDate" type="date" value={returnDate} onChange={setReturnDate} min={date || todayIst()} error={fields.returnDate} isRequired />
              <TextInput label="Return time" name="returnTime" type="time" value={returnTime} onChange={setReturnTime} error={fields.returnTime} description="When you want to start back" isRequired />
            </div>
          )}

          <SelectField
            label="Vehicle"
            options={(vehicles ?? []).map((v) => ({
              id: v.id,
              name: `${v.make} ${v.model} · ${VEHICLE_TYPES.find((t) => t.id === v.vehicleType)?.name ?? v.vehicleType} · ${v.transmission === 'manual' ? 'Manual' : 'Automatic'}`,
            }))}
            value={vehicleId}
            onChange={setVehicleId}
            error={fields.vehicleId}
            isRequired
          />
          <SelectField
            label="Driver language (optional)"
            placeholder="Any language"
            options={[{ id: 'any', name: 'Any language' }, ...LANGUAGES.map((l) => ({ id: l, name: l }))]}
            value={language ?? 'any'}
            onChange={(v) => setLanguage(v && v !== 'any' ? v : null)}
          />
          <p className="text-xs text-muted">Times are in India Standard Time (IST).</p>

          <FormAlert message={error} />
          <PendingButton type="submit" pending={pending} pendingLabel="Finding drivers…" className="w-full">Find available drivers</PendingButton>
        </Form>

        <div ref={resultsRef} className="flex scroll-mt-24 flex-col gap-4">
          {estimate ? (
            <RouteSummary estimate={estimate} />
          ) : (
            <div className="hidden rounded-[14px] border border-dashed border-border p-8 text-center text-sm text-muted lg:block">
              Choose your pickup and drop to see the route.
            </div>
          )}
          {result && <Results result={result} />}
        </div>
      </div>
    </AppShell>
  );
}

function Results({ result }: { result: SearchResponse }) {
  const { search, drivers, noResults } = result;
  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold">{noResults ? 'No drivers found' : `${drivers.length} available ${drivers.length === 1 ? 'driver' : 'drivers'}`}</h2>
        <p className="text-sm text-muted">
          {search.tripType === 'one_way' ? 'One-way' : 'Round-trip'} · pickup {formatIst(search.pickupAt)}
          {search.returnAt ? ` · return ${formatIst(search.returnAt)}` : ''} · {search.vehicle.make} {search.vehicle.model}
        </p>
      </div>

      {noResults ? (
        <div className="flex flex-col items-center gap-3 rounded-[14px] border border-border bg-white p-8 text-center">
          <SearchX className="size-8 text-muted" aria-hidden />
          <p className="font-semibold">{noResults.message}</p>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {noResults.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      ) : (
        <>
          {drivers.map((d) => <DriverResultCard key={d.driverId} driver={d} />)}
          <p className="text-xs text-muted">
            Availability is checked again when you request a booking. A driver is only confirmed once they accept your request.
          </p>
        </>
      )}
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/app" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> Back
    </Link>
  );
}
