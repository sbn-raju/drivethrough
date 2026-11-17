export type TripType = 'one_way' | 'round_trip';

export type PlaceSuggestion = { id: string; name: string; address: string };

export type ResolvedPlace = {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  stateCode: string | null;
  stateName: string | null;
};

export type RouteEstimate = {
  id: string;
  pickup: ResolvedPlace;
  drop: ResolvedPlace;
  distanceMeters: number;
  durationSeconds: number;
  routeStates: { code: string; name: string; enabled: boolean }[];
  coverage: {
    status: 'determined' | 'approximate' | 'uncertain';
    method: string;
    note: string;
    serviceable: boolean;
    reason: 'route_uncertain' | 'state_not_served' | null;
  };
  provider: string;
  estimatedAt: string;
  expiresAt: string;
  isEstimate: true;
};

export type DriverResult = {
  driverId: string;
  displayName: string;
  photoUrl: string | null;
  experienceYears: number;
  languages: string[];
  verification: 'verified';
  rating: number | null;
  reviewCount: number;
  completedTrips: number;
  rate: { currency: string; hourlyRate: number; minimumBillableHours: number };
  fareEstimate: null;
  tripTypes: TripType[];
  coverage: { code: string; name: string }[];
  availability: 'available_for_full_trip';
};

export type SearchResponse = {
  search: {
    routeEstimateId: string;
    tripType: TripType;
    pickupAt: string;
    returnAt: string | null;
    estimatedEndAt: string;
    reservedWindow: { start: string; end: string };
    vehicle: { id: string; make: string; model: string; vehicleType: string; transmission: string };
    language: string | null;
    searchedAt: string;
  };
  route: RouteEstimate;
  drivers: DriverResult[];
  noResults: null | { reason: string; message: string; suggestions: string[] };
};

export const formatDistance = (m: number) => (m >= 10_000 ? `${Math.round(m / 1000)} km` : `${(m / 1000).toFixed(1)} km`);

export const formatDuration = (s: number) => {
  const mins = Math.round(s / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

export const formatRupees = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

/** Market time zone is IST (fixed UTC+05:30); the trip form collects local date + time. */
export const istIso = (date: string, time: string) => `${date}T${time}:00+05:30`;

export const formatIst = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
