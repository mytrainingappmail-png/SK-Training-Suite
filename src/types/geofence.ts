// src/types/geofence.ts
//
// Multi-location attendance geofencing. A company can define any
// number of named, searched-by-place-name locations (an office, a
// project site visit, etc.) — not just one office per branch. Each
// employee has a scope: 'all' (any active company location is
// acceptable) or 'specific' (only the locations explicitly linked to
// them via employee_attendance_locations). A company with zero
// configured locations is never restricted — geofencing stays fully
// opt-in, matching the previous per-branch design.

export type LocationType = 'office' | 'site' | 'other';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  office: 'Office',
  site: 'Site',
  other: 'Other',
};

export interface AttendanceLocation {
  id: string;
  company_id: string;
  branch_id: string | null;
  location_name: string;
  location_type: LocationType;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type AttendanceLocationForm = Omit<AttendanceLocation, 'id' | 'created_at' | 'updated_at'>;

export const defaultAttendanceLocationForm: AttendanceLocationForm = {
  company_id: '',
  branch_id: null,
  location_name: '',
  location_type: 'office',
  address: '',
  latitude: 0,
  longitude: 0,
  radius_meters: 200,
  active: true,
};

// ── Employee scope ────────────────────────────────────────────────────────────

export type AttendanceLocationScope = 'all' | 'specific';

export const ATTENDANCE_SCOPE_LABELS: Record<AttendanceLocationScope, string> = {
  all: 'All Locations',
  specific: 'Specific Locations',
};

export interface EmployeeAttendanceLocation {
  id: string;
  employee_id: string;
  location_id: string;
  created_at: string;
}

/**
 * Real great-circle distance between two GPS coordinates, in meters
 * (the Haversine formula) — not an approximation, this is the
 * standard, accurate way to compute distance between lat/lng points.
 */
export function distanceInMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
