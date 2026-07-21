// src/services/geofence/geofenceService.ts
//
// Business logic — validation + orchestration. Delegates Supabase
// access to geofenceRepository.ts.
//
// Multi-location model: a company can configure any number of named
// locations (office, site visit, etc.), each with its own GPS point +
// radius. Each employee has a scope — 'all' (any active company
// location is acceptable) or 'specific' (only their linked
// locations). A company with zero configured locations is never
// restricted, same as the previous per-branch design.

import {
  getLocationsForCompany,
  createLocation as repositoryCreateLocation,
  updateLocation,
  removeLocation as repositoryRemoveLocation,
  getEmployeeLocationLinks,
  getAllEmployeeLocationLinks,
  setEmployeeLocationLinks,
  setEmployeeAttendanceScope,
} from '../../repositories/geofence/geofenceRepository';
import { distanceInMeters } from '../../types/geofence';
import type {
  AttendanceLocation,
  AttendanceLocationForm,
  AttendanceLocationScope,
} from '../../types/geofence';

export async function loadLocations(companyId: string): Promise<AttendanceLocation[]> {
  return getLocationsForCompany(companyId);
}

function validateLocationForm(form: Partial<AttendanceLocationForm>): void {
  if (!form.company_id) throw new Error('Company is required.');
  if (!form.location_name?.trim()) throw new Error('Location name is required.');
  if (form.latitude !== undefined && (form.latitude < -90 || form.latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (form.longitude !== undefined && (form.longitude < -180 || form.longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180.');
  }
  if (form.radius_meters !== undefined && form.radius_meters <= 0) {
    throw new Error('Radius must be greater than 0.');
  }
}

export async function createLocation(form: AttendanceLocationForm): Promise<AttendanceLocation> {
  validateLocationForm(form);
  return repositoryCreateLocation(form);
}

export async function saveLocation(id: string, form: Partial<AttendanceLocationForm>): Promise<AttendanceLocation> {
  if (!id) throw new Error('Invalid location ID.');
  validateLocationForm(form);
  return updateLocation(id, form);
}

export async function removeLocation(id: string): Promise<void> {
  if (!id) throw new Error('Invalid location ID.');
  await repositoryRemoveLocation(id);
}

// ── Employee assignment ───────────────────────────────────────────────────────

export async function loadEmployeeLocationIds(employeeId: string): Promise<string[]> {
  const links = await getEmployeeLocationLinks(employeeId);
  return links.map((l) => l.location_id);
}

export async function loadAllEmployeeLocationMap(): Promise<Record<string, string[]>> {
  const links = await getAllEmployeeLocationLinks();
  const map: Record<string, string[]> = {};
  links.forEach((l) => {
    if (!map[l.employee_id]) map[l.employee_id] = [];
    map[l.employee_id].push(l.location_id);
  });
  return map;
}

export async function setEmployeeLocations(employeeId: string, locationIds: string[]): Promise<void> {
  if (!employeeId) throw new Error('Invalid employee ID.');
  await setEmployeeLocationLinks(employeeId, locationIds);
}

export async function setEmployeeScope(employeeId: string, scope: AttendanceLocationScope): Promise<void> {
  if (!employeeId) throw new Error('Invalid employee ID.');
  await setEmployeeAttendanceScope(employeeId, scope);
}

// ── Place search ──────────────────────────────────────────────────────────────
//
// Uses Google Places (much better coverage of private project/building
// names) when VITE_GOOGLE_PLACES_API_KEY is set in .env — no code
// changes needed to switch it on later, just add the key and restart.
// Falls back to the free OpenStreetMap Nominatim search otherwise (and
// if a configured Google key ever errors out).

export interface PlaceSearchResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

const GOOGLE_PLACES_API_KEY = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined)?.trim();

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (GOOGLE_PLACES_API_KEY) {
    try {
      return await searchPlacesGoogle(q, GOOGLE_PLACES_API_KEY);
    } catch {
      // Fall through to the free search below rather than failing outright.
    }
  }

  return searchPlacesNominatim(q);
}

interface GooglePlacesResponse {
  places?: {
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }[];
}

async function searchPlacesGoogle(query: string, apiKey: string): Promise<PlaceSearchResult[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!response.ok) throw new Error('Google Places search failed.');

  const data = (await response.json()) as GooglePlacesResponse;
  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      displayName: p.formattedAddress || p.displayName?.text || query,
      latitude: p.location!.latitude,
      longitude: p.location!.longitude,
    }));
}

async function searchPlacesNominatim(query: string): Promise<PlaceSearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=6&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Location search failed. Please try again.');

  const rows = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({
    displayName: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
  }));
}

// ── Check-in / check-out geofence check ───────────────────────────────────────

export interface GeofenceCheckResult {
  withinFence: boolean;
  distanceMeters: number | null;
  message: string;
}

/**
 * Checks a real GPS coordinate against an employee's allowed
 * location(s). No configured locations at all for the company means
 * unrestricted (geofencing is opt-in). scope === 'all' passes if the
 * coordinate is within range of ANY active company location.
 * scope === 'specific' only checks the employee's explicitly linked
 * locations — if none are linked (an admin configuration gap), this
 * falls back to unrestricted rather than silently locking the
 * employee out.
 */
export async function checkEmployeeWithinGeofence(
  employeeId: string,
  companyId: string,
  scope: AttendanceLocationScope,
  latitude: number,
  longitude: number
): Promise<GeofenceCheckResult> {
  const allLocations = (await getLocationsForCompany(companyId)).filter((l) => l.active);
  if (allLocations.length === 0) {
    return { withinFence: true, distanceMeters: null, message: 'No location restriction configured.' };
  }

  let candidates = allLocations;
  if (scope === 'specific') {
    const linkedIds = new Set(await loadEmployeeLocationIds(employeeId));
    const linked = allLocations.filter((l) => linkedIds.has(l.id));
    if (linked.length > 0) candidates = linked;
  }

  let nearest: { location: AttendanceLocation; distance: number } | null = null;
  for (const location of candidates) {
    const distance = distanceInMeters(latitude, longitude, location.latitude, location.longitude);
    if (!nearest || distance < nearest.distance) nearest = { location, distance };
    if (distance <= location.radius_meters) {
      return {
        withinFence: true,
        distanceMeters: Math.round(distance),
        message: `You are ${Math.round(distance)}m from ${location.location_name} — within range.`,
      };
    }
  }

  return {
    withinFence: false,
    distanceMeters: nearest ? Math.round(nearest.distance) : null,
    message: nearest
      ? `You are ${Math.round(nearest.distance)}m from ${nearest.location.location_name} — outside the allowed ${nearest.location.radius_meters}m range.`
      : 'You are outside every allowed check-in location.',
  };
}
