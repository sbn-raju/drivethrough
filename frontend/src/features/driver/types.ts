import type { DriverApprovalStatus } from '../../lib/api';

export type DriverDocument = {
  id: string;
  documentType: 'driving_licence' | 'identity_proof' | 'address_proof';
  documentSubtype: string | null;
  fileName: string | null;
  verificationStatus: 'submitted' | 'pending_review' | 'needs_resubmission' | 'approved' | 'rejected' | 'expired';
  documentNumberLast4: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenceClasses: string[];
  isSynthetic: boolean;
  reviewReason: string | null;
};

export type DriverOnboarding = {
  profile: {
    fullName: string | null;
    dateOfBirth: string | null;
    homeCity: string | null;
    homeState: string | null;
    bio: string | null;
    experienceYears: number | null;
    languages: string[];
    hasProfilePhoto: boolean;
    approvalStatus: DriverApprovalStatus;
    submittedAt: string | null;
    reviewReason: string | null;
  };
  documents: DriverDocument[];
  serviceAreas: { stateCode: string; name: string }[];
  checklist: { key: string; label: string; complete: boolean }[];
  canSubmit: boolean;
  dummyKyc: boolean;
};

export const EDITABLE_STATUSES: DriverApprovalStatus[] = ['not_submitted', 'needs_resubmission', 'rejected'];

/** Driver-facing verification vocabulary (design.md §8 "Driver verification states"). */
export const APPROVAL_LABELS: Record<DriverApprovalStatus, { label: string; color: 'default' | 'accent' | 'success' | 'warning' | 'danger' }> = {
  not_submitted: { label: 'Not submitted', color: 'default' },
  pending_review: { label: 'Under review', color: 'accent' },
  needs_resubmission: { label: 'Action required', color: 'warning' },
  approved: { label: 'Verified', color: 'success' },
  rejected: { label: 'Rejected', color: 'danger' },
  expired: { label: 'Documents expired', color: 'warning' },
  suspended: { label: 'Suspended', color: 'danger' },
};
