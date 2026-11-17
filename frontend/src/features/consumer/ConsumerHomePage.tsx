import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Car, MapPin } from 'lucide-react';
import { AccountCard } from '../../components/AccountCard';
import { AppShell } from '../../components/AppShell';
import { FormAlert } from '../../components/FormAlert';
import { useAuth } from '../auth/auth-context';
import { errorMessage, get } from '../../lib/api';
import { VEHICLE_TYPES } from '../../lib/constants';
import { VehicleForm } from './VehicleForm';
import type { Vehicle } from './types';

export function ConsumerHomePage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const firstName = user?.onboarding.fullName?.split(' ')[0];

  useEffect(() => {
    if (user?.role !== 'consumer') return;
    get<{ vehicles: Vehicle[] }>('/consumers/me/vehicles')
      .then((r) => setVehicles(r.vehicles.filter((v) => v.status === 'active')))
      .catch((e) => setError(errorMessage(e)));
  }, [user?.role]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-brand-black sm:text-4xl">{firstName ? `Hi, ${firstName}` : 'Welcome to DriveThrough'}</h1>
          <p className="mt-2 text-muted">Book a professional driver for your own car.</p>
        </div>

        <section className="flex flex-col gap-3 rounded-[14px] bg-brand-black p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-brand-yellow" aria-hidden />
            <div>
              <p className="font-semibold">Find a driver</p>
              <p className="text-sm text-white/70">Book a professional driver for a one-way or round-trip journey in your own car.</p>
            </div>
          </div>
          {user?.role === 'consumer' ? (
            <Link to="/trips/new" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-brand-yellow px-5 font-semibold text-brand-black hover:bg-brand-yellow-hover">
              Find a driver
            </Link>
          ) : (
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Consumers only</span>
          )}
        </section>

        {user?.role === 'consumer' && (
          <section className="rounded-[14px] border border-border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">My vehicles</h2>
              {!adding && (
                <button type="button" onClick={() => setAdding(true)} className="min-h-9 rounded-[10px] px-3 text-sm font-semibold underline-offset-4 hover:underline">
                  Add vehicle
                </button>
              )}
            </div>
            <FormAlert message={error} />
            {vehicles && vehicles.length === 0 && !adding && <p className="mt-3 text-sm text-muted">No vehicles yet. Add the car you'd like a driver for.</p>}
            <ul className="mt-4 flex flex-col gap-2">
              {vehicles?.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-[10px] border border-border px-4 py-3">
                  <Car className="size-5" aria-hidden />
                  <div>
                    <p className="font-semibold">{v.make} {v.model}</p>
                    <p className="text-xs text-muted">
                      {VEHICLE_TYPES.find((t) => t.id === v.vehicleType)?.name} · {v.transmission === 'manual' ? 'Manual' : 'Automatic'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {adding && (
              <div className="mt-5 border-t border-border pt-5">
                <VehicleForm onSaved={(v) => { setVehicles((list) => [v, ...(list ?? [])]); setAdding(false); }} />
              </div>
            )}
          </section>
        )}

        <AccountCard />
      </div>
    </AppShell>
  );
}
