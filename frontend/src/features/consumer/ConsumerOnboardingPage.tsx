import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, Form } from '@heroui/react';
import { Car, ChevronLeft } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { StepCard } from '../../components/StepCard';
import { Stepper } from '../../components/Stepper';
import { TextInput } from '../../components/TextInput';
import { FullPageSpinner } from '../auth/guards';
import { useAuth } from '../auth/auth-context';
import { ApiError, errorMessage, get, patch, post, put } from '../../lib/api';
import { VEHICLE_TYPES } from '../../lib/constants';
import type { ConsumerProfile, Vehicle } from './types';
import { VehicleForm } from './VehicleForm';

const STEPS = [
  { key: 'details', label: 'Your details' },
  { key: 'emergency', label: 'Emergency contact' },
  { key: 'vehicle', label: 'Your vehicle' },
];

export function ConsumerOnboardingPage() {
  const navigate = useNavigate();
  const { reloadUser } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    get<{ profile: ConsumerProfile; vehicles: Vehicle[] }>('/consumers/me')
      .then(({ profile, vehicles }) => {
        setProfile(profile);
        setVehicles(vehicles.filter((v) => v.status === 'active'));
        // Resume where the user left off.
        setStep(!profile.fullName ? 0 : !profile.emergencyContact ? 1 : 2);
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <FullPageSpinner />;

  const steps = STEPS.map((s, i) => ({
    ...s,
    complete: i === 0 ? !!profile?.fullName : i === 1 ? !!profile?.emergencyContact : vehicles.length > 0,
  }));

  async function finish() {
    await post('/consumers/me/onboarding/complete');
    await reloadUser();
    navigate('/app', { replace: true });
  }

  return (
    <AppShell>
      <FormAlert message={loadError} />
      <Stepper steps={steps} current={step} onSelect={setStep} />
      {step === 0 && <DetailsStep profile={profile} onDone={(p) => { setProfile(p); setStep(1); void reloadUser(); }} />}
      {step === 1 && (
        <EmergencyStep profile={profile} onBack={() => setStep(0)} onDone={(p) => { if (p) setProfile(p); setStep(2); }} />
      )}
      {step === 2 && (
        <VehicleStep vehicles={vehicles} onAdded={(v) => setVehicles((list) => [v, ...list])} onBack={() => setStep(1)} onFinish={finish} />
      )}
    </AppShell>
  );
}

function DetailsStep({ profile, onDone }: { profile: ConsumerProfile | null; onDone: (p: ConsumerProfile) => void }) {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await patch<{ profile: ConsumerProfile }>('/consumers/me', { fullName, city, address });
      onDone(res.profile);
    } catch (err) {
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Tell us about you"
        description="Your driver will see your first name when they accept a trip."
        actions={
          <>
            <span />
            <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
              Continue
            </PendingButton>
          </>
        }
      >
        <FormAlert message={error} />
        <TextInput label="Full name" name="fullName" value={fullName} onChange={setFullName} autoComplete="name" error={fields.fullName} isRequired />
        <TextInput label="City" name="city" value={city} onChange={setCity} autoComplete="address-level2" placeholder="e.g. Pune" error={fields.city} />
        <TextInput
          label="Home address (optional)"
          name="address"
          value={address}
          onChange={setAddress}
          autoComplete="street-address"
          multiline
          error={fields.address}
          description="Saves time when you plan a pickup from home."
        />
      </StepCard>
    </Form>
  );
}

function EmergencyStep({ profile, onBack, onDone }: { profile: ConsumerProfile | null; onBack: () => void; onDone: (p: ConsumerProfile | null) => void }) {
  const [name, setName] = useState(profile?.emergencyContact?.name ?? '');
  const [phone, setPhone] = useState(profile?.emergencyContact?.phone ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await put<{ profile: ConsumerProfile }>('/consumers/me/emergency-contact', { name, phone });
      onDone(res.profile);
    } catch (err) {
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Add an emergency contact"
        description="We'll only contact this person if there's a safety concern during one of your trips."
        actions={
          <>
            <Button variant="ghost" size="lg" onPress={onBack}>
              <ChevronLeft className="size-4" aria-hidden /> Back
            </Button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="tertiary" size="lg" onPress={() => onDone(null)}>
                Skip for now
              </Button>
              <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
                Continue
              </PendingButton>
            </div>
          </>
        }
      >
        <FormAlert message={error} />
        <TextInput label="Contact name" name="name" value={name} onChange={setName} error={fields.name} isRequired />
        <TextInput label="Contact mobile number" name="phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="98765 43210" error={fields.phone} isRequired />
      </StepCard>
    </Form>
  );
}

function VehicleStep({ vehicles, onAdded, onBack, onFinish }: { vehicles: Vehicle[]; onAdded: (v: Vehicle) => void; onBack: () => void; onFinish: () => Promise<void> }) {
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeName = (id: string) => VEHICLE_TYPES.find((t) => t.id === id)?.name ?? id;

  return (
    <StepCard
      title="Add your vehicle"
      description="Your driver drives your own car, so tell us what they'll be driving. You can add more vehicles later."
      actions={
        <>
          <Button variant="ghost" size="lg" onPress={onBack}>
            <ChevronLeft className="size-4" aria-hidden /> Back
          </Button>
          <PendingButton
            pending={finishing}
            pendingLabel="Finishing…"
            onPress={async () => {
              setFinishing(true);
              setError(null);
              try {
                await onFinish();
              } catch (err) {
                setError(errorMessage(err));
                setFinishing(false);
              }
            }}
          >
            {vehicles.length ? 'Finish setup' : 'Skip and finish'}
          </PendingButton>
        </>
      }
    >
      <FormAlert message={error} />
      {vehicles.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Your vehicles">
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-secondary/60 px-4 py-3">
              <Car className="size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {v.make} {v.model}
                </p>
                <p className="text-xs text-muted">
                  {typeName(v.vehicleType)} · {v.transmission === 'manual' ? 'Manual' : 'Automatic'}
                  {v.registrationReference ? ` · ${v.registrationReference}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <VehicleForm onSaved={onAdded} submitLabel={vehicles.length ? 'Add another vehicle' : 'Save vehicle'} />
    </StepCard>
  );
}
