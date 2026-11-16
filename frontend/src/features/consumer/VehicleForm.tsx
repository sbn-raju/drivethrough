import { useState, type FormEvent } from 'react';
import { Form, Label, Radio, RadioGroup } from '@heroui/react';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { SelectField } from '../../components/SelectField';
import { TextInput } from '../../components/TextInput';
import { ApiError, errorMessage, post } from '../../lib/api';
import { FUEL_TYPES, VEHICLE_TYPES } from '../../lib/constants';
import type { Vehicle } from './types';

export function VehicleForm({ onSaved, submitLabel = 'Save vehicle' }: { onSaved: (v: Vehicle) => void; submitLabel?: string }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [transmission, setTransmission] = useState<string>('');
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [registrationReference, setRegistration] = useState('');
  const [notes, setNotes] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (!vehicleType) local.vehicleType = 'Choose a vehicle type.';
    if (!transmission) local.transmission = 'Choose a transmission.';
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      const { vehicle } = await post<{ vehicle: Vehicle }>('/consumers/me/vehicles', {
        make, model, vehicleType, transmission, fuelType, registrationReference, notes,
      });
      onSaved(vehicle);
      setMake(''); setModel(''); setVehicleType(null); setTransmission(''); setFuelType(null); setRegistration(''); setNotes('');
    } catch (err) {
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Form className="flex flex-col gap-5" onSubmit={onSubmit} validationBehavior="aria">
      <FormAlert message={error} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Make" name="make" value={make} onChange={setMake} placeholder="e.g. Maruti Suzuki" error={fields.make} isRequired />
        <TextInput label="Model" name="model" value={model} onChange={setModel} placeholder="e.g. Swift" error={fields.model} isRequired />
        <SelectField label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} error={fields.vehicleType} isRequired />
        <SelectField label="Fuel type (optional)" options={FUEL_TYPES} value={fuelType} onChange={setFuelType} />
      </div>
      <RadioGroup value={transmission} onChange={setTransmission} orientation="horizontal" isInvalid={!!fields.transmission} isRequired name="transmission">
        <Label>Transmission</Label>
        {(['manual', 'automatic'] as const).map((t) => (
          <Radio key={t} value={t}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {t === 'manual' ? 'Manual' : 'Automatic'}
            </Radio.Content>
          </Radio>
        ))}
        {fields.transmission ? <p className="text-xs text-danger">{fields.transmission}</p> : null}
      </RadioGroup>
      <TextInput
        label="Registration number (optional)"
        name="registrationReference"
        value={registrationReference}
        onChange={setRegistration}
        placeholder="MH 12 AB 1234"
        error={fields.registrationReference}
        description="Only shared with your driver after they accept a booking."
      />
      <TextInput
        label="Notes for your driver (optional)"
        name="notes"
        value={notes}
        onChange={setNotes}
        multiline
        maxLength={500}
        placeholder="e.g. Reverse gear needs a firm push down."
        error={fields.notes}
      />
      <div>
        <PendingButton type="submit" variant="secondary" pending={pending} pendingLabel="Saving…">
          {submitLabel}
        </PendingButton>
      </div>
    </Form>
  );
}
