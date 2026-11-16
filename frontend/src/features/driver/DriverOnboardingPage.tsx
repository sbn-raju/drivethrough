import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button, Checkbox, Form } from '@heroui/react';
import { ChevronLeft, CircleCheck, CircleDashed, FlaskConical, Pencil } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FileDrop } from '../../components/FileDrop';
import { FormAlert } from '../../components/FormAlert';
import { PendingButton } from '../../components/PendingButton';
import { SelectField } from '../../components/SelectField';
import { StepCard } from '../../components/StepCard';
import { Stepper } from '../../components/Stepper';
import { TextInput } from '../../components/TextInput';
import { useAuth } from '../auth/auth-context';
import { FullPageSpinner } from '../auth/guards';
import { ApiError, api, errorMessage, get, patch, post, put } from '../../lib/api';
import { IDENTITY_DOCUMENTS, INDIAN_STATES, LANGUAGES, LICENCE_CLASSES, STATE_OPTIONS } from '../../lib/constants';
import { CheckboxChips } from './CheckboxChips';
import { EDITABLE_STATUSES, type DriverOnboarding } from './types';

const STEPS = [
  { key: 'personal', label: 'Personal details' },
  { key: 'professional', label: 'Photo and experience' },
  { key: 'licence', label: 'Driving licence' },
  { key: 'identity', label: 'Identity document' },
  { key: 'service_areas', label: 'Operating states' },
  { key: 'review', label: 'Review and submit' },
];

type StepProps = {
  data: DriverOnboarding;
  onSaved: (d: DriverOnboarding) => void;
  onBack: () => void;
};

/** Shared submit/back/error plumbing for each step. */
function useStepSubmit(onSaved: (d: DriverOnboarding) => void) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<DriverOnboarding>, local: Record<string, string> = {}) {
    if (pending) return;
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;
    setPending(true);
    try {
      onSaved(await fn());
    } catch (err) {
      if (err instanceof ApiError) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return { fields, error, pending, run };
}

function StepActions({ onBack, pending, label = 'Save and continue' }: { onBack?: () => void; pending: boolean; label?: string }) {
  return (
    <>
      {onBack ? (
        <Button variant="ghost" size="lg" onPress={onBack}>
          <ChevronLeft className="size-4" aria-hidden /> Back
        </Button>
      ) : (
        <span />
      )}
      <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
        {label}
      </PendingButton>
    </>
  );
}

const firstIncomplete = (d: DriverOnboarding) => {
  const i = d.checklist.findIndex((c) => !c.complete);
  return i === -1 ? STEPS.length - 1 : i;
};

export function DriverOnboardingPage() {
  const navigate = useNavigate();
  const { reloadUser } = useAuth();
  const [data, setData] = useState<DriverOnboarding | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    get<DriverOnboarding>('/drivers/me/onboarding')
      .then((d) => {
        setData(d);
        setStep(firstIncomplete(d));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  if (loadError) {
    return (
      <AppShell>
        <FormAlert message={loadError} />
      </AppShell>
    );
  }
  if (!data) return <FullPageSpinner />;
  if (!EDITABLE_STATUSES.includes(data.profile.approvalStatus)) return <Navigate to="/driver" replace />;

  const steps = STEPS.map((s, i) => ({ ...s, complete: i < 5 ? data.checklist[i]?.complete : false }));
  const advance = (d: DriverOnboarding) => {
    if (step === 0) void reloadUser(); // header shows the newly entered name
    setData(d);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const props = { data, onSaved: advance, onBack: back };

  return (
    <AppShell>
      {data.profile.reviewReason && (
        <div className="mb-6">
          <FormAlert status="warning" title="Changes requested by our review team" message={data.profile.reviewReason} />
        </div>
      )}
      <Stepper steps={steps} current={step} onSelect={setStep} />
      {step === 0 && <PersonalStep {...props} />}
      {step === 1 && <ProfessionalStep {...props} />}
      {step === 2 && <LicenceStep {...props} />}
      {step === 3 && <IdentityStep {...props} />}
      {step === 4 && <ServiceAreasStep {...props} />}
      {step === 5 && (
        <ReviewStep
          {...props}
          onEdit={setStep}
          onSubmitted={async () => {
            await reloadUser();
            navigate('/driver', { replace: true });
          }}
        />
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function PersonalStep({ data, onSaved }: StepProps) {
  const p = data.profile;
  const [fullName, setFullName] = useState(p.fullName ?? '');
  const [dateOfBirth, setDob] = useState(p.dateOfBirth ?? '');
  const [homeCity, setHomeCity] = useState(p.homeCity ?? '');
  const [homeState, setHomeState] = useState<string | null>(p.homeState);
  const { fields, error, pending, run } = useStepSubmit(onSaved);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(() => patch('/drivers/me/profile', { fullName, dateOfBirth, homeCity, homeState }), {
      ...(!homeState ? { homeState: 'Choose your state.' } : {}),
      ...(!dateOfBirth ? { dateOfBirth: 'Enter your date of birth.' } : {}),
    });
  };

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard title="Personal details" description="Use your name exactly as it appears on your driving licence." actions={<StepActions pending={pending} />}>
        <FormAlert message={error} />
        <TextInput label="Full name" name="fullName" value={fullName} onChange={setFullName} autoComplete="name" error={fields.fullName} isRequired />
        <TextInput
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={setDob}
          autoComplete="bday"
          error={fields.dateOfBirth}
          description="You must be at least 18. Your date of birth is never shown to customers."
          isRequired
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="City you live in" name="homeCity" value={homeCity} onChange={setHomeCity} autoComplete="address-level2" error={fields.homeCity} isRequired />
          <SelectField label="State" options={STATE_OPTIONS} value={homeState} onChange={setHomeState} error={fields.homeState} isRequired />
        </div>
      </StepCard>
    </Form>
  );
}

function ProfessionalStep({ data, onSaved, onBack }: StepProps) {
  const p = data.profile;
  const [photo, setPhoto] = useState<File | null>(null);
  const [experienceYears, setExperience] = useState(p.experienceYears?.toString() ?? '');
  const [languages, setLanguages] = useState<string[]>(p.languages);
  const [bio, setBio] = useState(p.bio ?? '');
  const { fields, error, pending, run } = useStepSubmit(onSaved);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!photo && !p.hasProfilePhoto) local.photo = 'Add a clear photo of your face.';
    if (!languages.length) local.languages = 'Choose at least one language.';
    if (experienceYears === '') local.experienceYears = 'Enter your years of driving experience.';
    run(async () => {
      if (photo) {
        const form = new FormData();
        form.append('file', photo);
        await api('POST', '/drivers/me/profile-photo', form);
      }
      return patch('/drivers/me/profile', { experienceYears: Number(experienceYears), languages, bio: bio.trim() || null });
    }, local);
  };

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Photo and experience"
        description="Customers see your photo, experience and languages when choosing a driver."
        actions={<StepActions pending={pending} onBack={onBack} />}
      >
        <FormAlert message={error} />
        <FileDrop
          label="Profile photo"
          accept="image/jpeg,image/png,image/webp"
          file={photo}
          onFile={setPhoto}
          existingLabel={p.hasProfilePhoto ? 'Profile photo uploaded' : null}
          error={fields.photo ?? fields.file}
          description="A recent, well-lit photo of your face. JPG, PNG or WebP, up to 5 MB."
        />
        <TextInput
          label="Years of professional driving experience"
          name="experienceYears"
          type="number"
          inputMode="numeric"
          min="0"
          max="60"
          value={experienceYears}
          onChange={setExperience}
          error={fields.experienceYears}
          isRequired
        />
        <CheckboxChips
          label="Languages you speak"
          options={LANGUAGES.map((l) => ({ id: l, name: l }))}
          value={languages}
          onChange={setLanguages}
          error={fields.languages}
        />
        <TextInput
          label="About you (optional)"
          name="bio"
          multiline
          maxLength={500}
          value={bio}
          onChange={setBio}
          placeholder="e.g. 8 years driving families between Bengaluru and Mysuru. Comfortable with automatic SUVs."
          error={fields.bio}
        />
      </StepCard>
    </Form>
  );
}

function LicenceStep({ data, onSaved, onBack }: StepProps) {
  const existing = data.documents.find((d) => d.documentType === 'driving_licence');
  const [documentNumber, setNumber] = useState('');
  const [issuingAuthority, setAuthority] = useState<string | null>(existing?.issuingAuthority ?? null);
  const [licenceClasses, setClasses] = useState<string[]>(existing?.licenceClasses ?? []);
  const [issueDate, setIssueDate] = useState(existing?.issueDate ?? '');
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? '');
  const [file, setFile] = useState<File | null>(null);
  const { fields, error, pending, run } = useStepSubmit(onSaved);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!documentNumber.trim()) local.documentNumber = existing ? 'Re-enter your licence number to confirm it.' : 'Enter your licence number.';
    if (!issuingAuthority) local.issuingAuthority = 'Choose the issuing state.';
    if (!licenceClasses.length) local.licenceClasses = 'Choose at least one licence class.';
    if (!issueDate) local.issueDate = 'Enter the issue date.';
    if (!expiryDate) local.expiryDate = 'Enter the expiry date.';
    if (!file && !existing) local.file = 'Attach a photo or scan of your licence.';
    run(() => {
      const form = new FormData();
      form.append('documentNumber', documentNumber);
      form.append('issuingAuthority', issuingAuthority ?? '');
      form.append('licenceClasses', licenceClasses.join(','));
      form.append('issueDate', issueDate);
      form.append('expiryDate', expiryDate);
      if (file) form.append('file', file);
      return api<DriverOnboarding>('POST', '/drivers/me/documents/driving-licence', form);
    }, local);
  };

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Driving licence"
        description="We review your licence before you can accept trips. Your licence number is encrypted and never shown to customers."
        actions={<StepActions pending={pending} onBack={onBack} />}
      >
        <FormAlert message={error} />
        <TextInput
          label="Licence number"
          name="documentNumber"
          value={documentNumber}
          onChange={setNumber}
          placeholder="e.g. KA01 20150012345"
          error={fields.documentNumber}
          description={existing?.documentNumberLast4 ? `Saved licence ends in ${existing.documentNumberLast4}. Re-enter it to make changes.` : undefined}
          isRequired
        />
        <SelectField label="Issuing state" options={STATE_OPTIONS} value={issuingAuthority} onChange={setAuthority} error={fields.issuingAuthority} isRequired />
        <CheckboxChips label="Licence classes" description="Select every class printed on your licence." options={LICENCE_CLASSES} value={licenceClasses} onChange={setClasses} error={fields.licenceClasses} columns />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Issue date" name="issueDate" type="date" value={issueDate} onChange={setIssueDate} error={fields.issueDate} isRequired />
          <TextInput label="Valid until" name="expiryDate" type="date" value={expiryDate} onChange={setExpiryDate} error={fields.expiryDate} isRequired />
        </div>
        <FileDrop
          label="Licence photo or scan"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          file={file}
          onFile={setFile}
          existingLabel={existing ? `Uploaded${existing.fileName ? `: ${existing.fileName}` : ''}` : null}
          error={fields.file}
          description="Front side, all corners visible and text readable. JPG, PNG, WebP or PDF, up to 5 MB."
        />
      </StepCard>
    </Form>
  );
}

function IdentityStep({ data, onSaved, onBack }: StepProps) {
  const existing = data.documents.find((d) => d.documentType === 'identity_proof');
  const [documentSubtype, setSubtype] = useState<string | null>(existing?.documentSubtype ?? null);
  const [documentNumber, setNumber] = useState('');
  const [expiryDate, setExpiry] = useState(existing?.expiryDate ?? '');
  const [file, setFile] = useState<File | null>(null);
  const { fields, error, pending, run } = useStepSubmit(onSaved);
  const needsExpiry = documentSubtype === 'passport';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!documentSubtype) local.documentSubtype = 'Choose a document type.';
    if (!documentNumber.trim()) local.documentNumber = existing ? 'Re-enter the document number to confirm it.' : 'Enter the document number.';
    if (needsExpiry && !expiryDate) local.expiryDate = 'Enter the expiry date.';
    if (!file && !existing) local.file = 'Attach a photo or scan of the document.';
    run(() => {
      const form = new FormData();
      form.append('documentSubtype', documentSubtype ?? '');
      form.append('documentNumber', documentNumber);
      form.append('expiryDate', needsExpiry ? expiryDate : '');
      if (file) form.append('file', file);
      return api<DriverOnboarding>('POST', '/drivers/me/documents/identity-proof', form);
    }, local);
  };

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Identity document"
        description="Used only to confirm who you are. Customers never see your documents or document numbers."
        actions={<StepActions pending={pending} onBack={onBack} />}
      >
        <FormAlert message={error} />
        <SelectField label="Document type" options={IDENTITY_DOCUMENTS} value={documentSubtype} onChange={setSubtype} error={fields.documentSubtype} isRequired />
        <TextInput
          label="Document number"
          name="documentNumber"
          value={documentNumber}
          onChange={setNumber}
          error={fields.documentNumber}
          description={existing?.documentNumberLast4 ? `Saved document ends in ${existing.documentNumberLast4}. Re-enter it to make changes.` : undefined}
          isRequired
        />
        {needsExpiry && <TextInput label="Valid until" name="expiryDate" type="date" value={expiryDate} onChange={setExpiry} error={fields.expiryDate} isRequired />}
        <FileDrop
          label="Document photo or scan"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          file={file}
          onFile={setFile}
          existingLabel={existing ? `Uploaded${existing.fileName ? `: ${existing.fileName}` : ''}` : null}
          error={fields.file}
          description="JPG, PNG, WebP or PDF, up to 5 MB."
        />
      </StepCard>
    </Form>
  );
}

function ServiceAreasStep({ data, onSaved, onBack }: StepProps) {
  const [stateCodes, setStateCodes] = useState<string[]>(data.serviceAreas.map((a) => a.stateCode));
  const { fields, error, pending, run } = useStepSubmit(onSaved);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(() => put('/drivers/me/service-areas', { stateCodes }), stateCodes.length ? {} : { stateCodes: 'Choose at least one state.' });
  };

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Where do you drive?"
        description="Choose the states you're willing to drive in. You'll only get trip requests that start or travel through these states."
        actions={<StepActions pending={pending} onBack={onBack} />}
      >
        <FormAlert message={error} />
        <CheckboxChips label="Operating states" options={STATE_OPTIONS} value={stateCodes} onChange={setStateCodes} error={fields.stateCodes} columns />
      </StepCard>
    </Form>
  );
}

function ReviewStep({ data, onBack, onEdit, onSubmitted }: StepProps & { onEdit: (i: number) => void; onSubmitted: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const p = data.profile;
  const licence = data.documents.find((d) => d.documentType === 'driving_licence');
  const identity = data.documents.find((d) => d.documentType === 'identity_proof');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!confirmed) {
      setConfirmError('Confirm that your details are accurate.');
      return;
    }
    setConfirmError(null);
    setError(null);
    setPending(true);
    try {
      await post('/drivers/me/submit');
      await onSubmitted();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Form onSubmit={onSubmit} validationBehavior="aria">
      <StepCard
        title="Review and submit"
        description="Check your details. Once submitted, our team reviews your documents — you can't edit them while the review is in progress."
        actions={<StepActions pending={pending} onBack={onBack} label="Submit for review" />}
      >
        <FormAlert message={error} />
        {data.dummyKyc && (
          <div className="flex gap-3 rounded-[10px] border border-warning/40 bg-warning/10 p-4 text-sm">
            <FlaskConical className="size-5 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Test mode: synthetic documents.</span> File storage isn't configured, so uploads are recorded as dummy KYC.
              These records can never be approved in production.
            </p>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
          <ReviewRow index={0} done={data.checklist[0].complete} title="Personal details" onEdit={onEdit}>
            {p.fullName ?? '—'} · {p.homeCity ?? '—'}, {p.homeState ? INDIAN_STATES[p.homeState] : '—'}
          </ReviewRow>
          <ReviewRow index={1} done={data.checklist[1].complete} title="Photo and experience" onEdit={onEdit}>
            {p.hasProfilePhoto ? 'Photo added' : 'No photo'} · {p.experienceYears ?? '—'} years · {p.languages.join(', ') || 'No languages'}
          </ReviewRow>
          <ReviewRow index={2} done={data.checklist[2].complete} title="Driving licence" onEdit={onEdit}>
            {licence ? `Ending ${licence.documentNumberLast4} · ${licence.licenceClasses.join(', ')} · valid until ${licence.expiryDate}` : 'Not added'}
          </ReviewRow>
          <ReviewRow index={3} done={data.checklist[3].complete} title="Identity document" onEdit={onEdit}>
            {identity ? `${IDENTITY_DOCUMENTS.find((d) => d.id === identity.documentSubtype)?.name ?? 'Document'} ending ${identity.documentNumberLast4}` : 'Not added'}
          </ReviewRow>
          <ReviewRow index={4} done={data.checklist[4].complete} title="Operating states" onEdit={onEdit}>
            {data.serviceAreas.map((a) => a.name).join(', ') || 'None selected'}
          </ReviewRow>
        </ul>

        <p className="text-sm text-muted">Next, after verification, you'll set your rates and availability from your dashboard.</p>

        <div className="flex flex-col gap-1">
          <Checkbox isSelected={confirmed} onChange={setConfirmed} isInvalid={!!confirmError} isDisabled={!data.canSubmit}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-sm">I confirm these details and documents are genuine and belong to me.</span>
            </Checkbox.Content>
          </Checkbox>
          {confirmError ? <p className="text-xs text-danger">{confirmError}</p> : null}
          {!data.canSubmit ? <p className="text-xs text-danger">Complete every step above before submitting.</p> : null}
        </div>
      </StepCard>
    </Form>
  );
}

function ReviewRow({ index, title, done, children, onEdit }: { index: number; title: string; done: boolean; children: ReactNode; onEdit: (i: number) => void }) {
  return (
    <li className="flex items-start gap-3 p-4">
      {done ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="Complete" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted" aria-label="Incomplete" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm break-words text-muted">{children}</p>
      </div>
      <Button size="sm" variant="ghost" onPress={() => onEdit(index)} aria-label={`Edit ${title}`}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
    </li>
  );
}
