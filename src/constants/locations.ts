// The cities content can be limited to (Induction days and sections). An employee's location is the city of
// their branch, matched to this list by name — Gurugram counts as Gurgaon, Bengaluru as Bangalore, and so on.
// Stored on content as the short `key`, so the same day means the same thing in every company.

export interface AppLocation {
  key: string;
  label: string;
  /** Other spellings people use for the same city (lower case). */
  aliases?: string[];
}

export const LOCATIONS: AppLocation[] = [
  { key: 'gurgaon', label: 'Gurgaon', aliases: ['gurugram'] },
  { key: 'mohali', label: 'Mohali', aliases: ['sas nagar', 's a s nagar', 'sahibzada ajit singh nagar'] },
  { key: 'noida', label: 'Noida' },
  { key: 'greater-noida', label: 'Greater Noida' },
  { key: 'faridabad', label: 'Faridabad' },
  { key: 'ghaziabad', label: 'Ghaziabad' },
  { key: 'delhi', label: 'Delhi', aliases: ['new delhi'] },
  { key: 'chandigarh', label: 'Chandigarh' },
  { key: 'panchkula', label: 'Panchkula' },
  { key: 'jaipur', label: 'Jaipur' },
  { key: 'lucknow', label: 'Lucknow' },
  { key: 'mumbai', label: 'Mumbai', aliases: ['bombay'] },
  { key: 'navi-mumbai', label: 'Navi Mumbai' },
  { key: 'thane', label: 'Thane' },
  { key: 'pune', label: 'Pune', aliases: ['poona'] },
  { key: 'ahmedabad', label: 'Ahmedabad' },
  { key: 'indore', label: 'Indore' },
  { key: 'bangalore', label: 'Bangalore', aliases: ['bengaluru'] },
  { key: 'hyderabad', label: 'Hyderabad' },
  { key: 'chennai', label: 'Chennai', aliases: ['madras'] },
  { key: 'kolkata', label: 'Kolkata', aliases: ['calcutta'] },
];

function clean(text: string): string {
  return text.toLowerCase().replace(/[.\-_,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The location key for a free-text city/branch name, or null when it is not one we know. */
export function locationKeyFor(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = clean(text);
  if (!t) return null;
  for (const l of LOCATIONS) {
    if (clean(l.label) === t || l.key.replace(/-/g, ' ') === t || (l.aliases ?? []).some((a) => clean(a) === t)) return l.key;
  }
  return null;
}

/** An employee's location key from their branch: its city first, then its name. */
export function employeeLocationKey(branch: { city?: string | null; branch_name?: string | null } | null | undefined): string | null {
  if (!branch) return null;
  return locationKeyFor(branch.city) ?? locationKeyFor(branch.branch_name);
}

/** Is something limited to certain locations visible to someone in `locationKey`? (No limit = visible to all.) */
export function visibleInLocation(locations: string[] | null | undefined, locationKey: string | null): boolean {
  if (!locations || locations.length === 0) return true;
  return locationKey !== null && locations.includes(locationKey);
}

export function locationLabel(key: string): string {
  return LOCATIONS.find((l) => l.key === key)?.label ?? key;
}
