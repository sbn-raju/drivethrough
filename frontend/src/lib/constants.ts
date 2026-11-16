/** Mirrors backend/src/common/constants.ts */
export const INDIAN_STATES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar',
  CH: 'Chandigarh', CT: 'Chhattisgarh', DH: 'Dadra and Nagar Haveli and Daman and Diu', DL: 'Delhi', GA: 'Goa',
  GJ: 'Gujarat', HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu and Kashmir', KA: 'Karnataka',
  KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur',
  MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OR: 'Odisha', PB: 'Punjab', PY: 'Puducherry',
  RJ: 'Rajasthan', SK: 'Sikkim', TG: 'Telangana', TN: 'Tamil Nadu', TR: 'Tripura', UP: 'Uttar Pradesh',
  UT: 'Uttarakhand', WB: 'West Bengal',
};

export const STATE_OPTIONS = Object.entries(INDIAN_STATES)
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const VEHICLE_TYPES = [
  { id: 'hatchback', name: 'Hatchback' },
  { id: 'sedan', name: 'Sedan' },
  { id: 'suv', name: 'SUV' },
  { id: 'muv', name: 'MUV / MPV' },
  { id: 'luxury', name: 'Luxury' },
  { id: 'van', name: 'Van' },
  { id: 'pickup', name: 'Pickup' },
  { id: 'other', name: 'Other' },
];

export const FUEL_TYPES = [
  { id: 'petrol', name: 'Petrol' },
  { id: 'diesel', name: 'Diesel' },
  { id: 'cng', name: 'CNG' },
  { id: 'electric', name: 'Electric' },
  { id: 'hybrid', name: 'Hybrid' },
  { id: 'other', name: 'Other' },
];

export const LICENCE_CLASSES = [
  { id: 'LMV', name: 'LMV', description: 'Light motor vehicle' },
  { id: 'LMV-NT', name: 'LMV-NT', description: 'Light motor vehicle, non-transport' },
  { id: 'LMV-TR', name: 'LMV-TR', description: 'Light motor vehicle, transport' },
  { id: 'TRANS', name: 'TRANS', description: 'Transport vehicle' },
  { id: 'HMV', name: 'HMV', description: 'Heavy motor vehicle' },
  { id: 'MCWG', name: 'MCWG', description: 'Motorcycle with gear' },
];

export const IDENTITY_DOCUMENTS = [
  { id: 'aadhaar', name: 'Aadhaar card' },
  { id: 'pan', name: 'PAN card' },
  { id: 'passport', name: 'Passport' },
  { id: 'voter_id', name: 'Voter ID' },
];

export const LANGUAGES = [
  'Hindi', 'English', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu',
  'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Konkani',
];
