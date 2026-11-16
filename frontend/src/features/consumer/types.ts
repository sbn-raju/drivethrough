export type Vehicle = {
  id: string;
  make: string;
  model: string;
  vehicleType: string;
  transmission: 'manual' | 'automatic';
  fuelType: string | null;
  registrationReference: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
};

export type ConsumerProfile = {
  fullName: string | null;
  address: string | null;
  city: string | null;
  identityStatus: string;
  emergencyContact: { name: string; phone: string } | null;
  onboardingCompleted: boolean;
};
