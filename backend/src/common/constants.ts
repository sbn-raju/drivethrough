/** Indian states and union territories (ISO 3166-2:IN subdivision codes). */
export const INDIAN_STATES = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar',
  CH: 'Chandigarh', CT: 'Chhattisgarh', DH: 'Dadra and Nagar Haveli and Daman and Diu', DL: 'Delhi', GA: 'Goa',
  GJ: 'Gujarat', HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu and Kashmir', KA: 'Karnataka',
  KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur',
  MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OR: 'Odisha', PB: 'Punjab', PY: 'Puducherry',
  RJ: 'Rajasthan', SK: 'Sikkim', TG: 'Telangana', TN: 'Tamil Nadu', TR: 'Tripura', UP: 'Uttar Pradesh',
  UT: 'Uttarakhand', WB: 'West Bengal',
} as const;

export type StateCode = keyof typeof INDIAN_STATES;
export const STATE_CODES = Object.keys(INDIAN_STATES) as [StateCode, ...StateCode[]];

export const IDENTITY_DOCUMENT_TYPES = ['aadhaar', 'pan', 'passport', 'voter_id'] as const;
export const LICENCE_CLASSES = ['LMV', 'LMV-NT', 'LMV-TR', 'MCWG', 'HMV', 'TRANS'] as const;
