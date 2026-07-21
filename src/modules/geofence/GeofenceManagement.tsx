// src/modules/geofence/GeofenceManagement.tsx
//
// Admin defines any number of named attendance locations (office, a
// project site visit, etc.) — pick a point three ways: search a place
// name (best-effort; OpenStreetMap has patchy coverage of private
// project names), tap "Use My Location" while standing there, or type
// latitude/longitude directly (e.g. copied from Google Maps). Then
// assign employees a check-in scope in bulk, filtered by department/
// designation, like a standard HRMS attendance policy screen.

import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { employeeService } from '../../services/employee/employeeService';
import { departmentService } from '../../services/department/departmentService';
import { designationService } from '../../services/designation/designationService';
import {
  loadLocations,
  createLocation,
  saveLocation,
  removeLocation,
  searchPlaces,
  loadAllEmployeeLocationMap,
  setEmployeeLocations,
  setEmployeeScope,
} from '../../services/geofence/geofenceService';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { Designation } from '../../types/designation';
import type {
  AttendanceLocation,
  AttendanceLocationScope,
  LocationType,
  PlaceSearchResult,
} from '../../types/geofence';
import { LOCATION_TYPE_LABELS, ATTENDANCE_SCOPE_LABELS } from '../../types/geofence';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconMapPin({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>);
}
function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconPencil({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>);
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}
function IconCrosshair({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15 0a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>{children}</button>);
}
function DangerButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

const TYPE_BADGE_CLS: Record<LocationType, string> = {
  office: 'bg-indigo-50 text-indigo-700',
  site: 'bg-amber-50 text-amber-700',
  other: 'bg-slate-100 text-slate-600',
};

const SCOPE_BADGE_CLS: Record<AttendanceLocationScope, string> = {
  all: 'bg-emerald-50 text-emerald-700',
  specific: 'bg-indigo-50 text-indigo-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Location dialog — search a place (best effort), use your
// current GPS position, or type latitude/longitude directly. All
// three fill the same two fields below, which stay editable either way.
// ─────────────────────────────────────────────────────────────────────────────

function LocationDialog({
  editing, saving, onSave, onCancel,
}: {
  editing: AttendanceLocation | null;
  saving: boolean;
  onSave: (data: { name: string; type: LocationType; address: string; lat: number; lng: number; radius: number }) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  const [name, setName] = useState(editing?.location_name ?? '');
  const [type, setType] = useState<LocationType>(editing?.location_type ?? 'office');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [lat, setLat] = useState(editing ? String(editing.latitude) : '');
  const [lng, setLng] = useState(editing ? String(editing.longitude) : '');
  const [radius, setRadius] = useState(String(editing?.radius_meters ?? 200));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError('');
    if (query.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      searchPlaces(query)
        .then((rows) => {
          setResults(rows);
          if (rows.length === 0) setSearchError("No matches — try 'Use My Location' or enter coordinates manually below.");
        })
        .catch(() => { setResults([]); setSearchError('Search failed. Try again or enter coordinates manually below.'); })
        .finally(() => setSearching(false));
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pickResult(r: PlaceSearchResult) {
    setLat(String(r.latitude));
    setLng(String(r.longitude));
    setAddress(r.displayName);
    if (!name.trim()) setName(r.displayName.split(',')[0]);
    setResults([]);
    setQuery('');
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      (err) => {
        setLocateError(`Could not get location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const canSave =
    name.trim().length > 0 &&
    lat.trim().length > 0 && lng.trim().length > 0 &&
    !Number.isNaN(latNum) && !Number.isNaN(lngNum) &&
    latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;

  function handleSubmit() {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      type,
      address: address.trim(),
      lat: latNum,
      lng: lngNum,
      radius: Math.max(1, Number(radius) || 200),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={!saving ? onCancel : undefined} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{editing ? 'Edit Location' : 'Add Location'}</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Search Place (optional)</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Cyber Hub, Gurgaon"
              className={INPUT_CLS}
            />
            {searching && <div className="absolute right-3 top-9 text-slate-400"><IconSpinner className="h-4 w-4" /></div>}
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.map((r, i) => (
                  <button key={i} type="button" onClick={() => pickResult(r)} className="block w-full border-b border-slate-50 px-3 py-2 text-left text-sm text-slate-700 last:border-0 hover:bg-indigo-50">
                    {r.displayName}
                  </button>
                ))}
              </div>
            )}
            {searchError && <p className="mt-1.5 text-xs text-amber-600">{searchError}</p>}
            <p className="mt-1.5 text-xs text-slate-400">
              Small/private project names are often missing from this free search — use the options below instead.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500">Latitude / Longitude</label>
              <SecondaryButton onClick={useMyLocation} disabled={locating} className="!px-2.5 !py-1.5 text-xs">
                {locating ? <IconSpinner className="h-3.5 w-3.5" /> : <IconCrosshair className="h-3.5 w-3.5" />} Use My Location
              </SecondaryButton>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude, e.g. 28.4595" className={INPUT_CLS} />
              <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude, e.g. 77.0266" className={INPUT_CLS} />
            </div>
            {locateError && <p className="mt-1.5 text-xs text-red-600">{locateError}</p>}
            <p className="mt-1.5 text-xs text-slate-400">
              Tip: open the spot in Google Maps, long-press the pin, and paste the coordinates shown there.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Location Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hero Homes Palatial Site" className={INPUT_CLS} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Address (optional)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Sector 104, Gurgaon" className={INPUT_CLS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as LocationType)} className={INPUT_CLS}>
                {(Object.keys(LOCATION_TYPE_LABELS) as LocationType[]).map((t) => (
                  <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Radius (meters)</label>
              <input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" min={1} className={INPUT_CLS} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={onCancel} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSubmit} disabled={saving || !canSave}>
              {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save Location
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ name, busy, onConfirm, onCancel }: { name: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Location</h3>
        <p className="mb-5 text-sm text-slate-500">
          Delete <span className="font-semibold text-slate-700">{name}</span>? Employees using this location will no longer be restricted by it.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onCancel} disabled={busy}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm} disabled={busy}>{busy ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Delete</DangerButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

type Section = 'locations' | 'employees';

function GeofenceManagement() {
  const user = getCurrentUser();
  const companyId = user?.companyId ?? '';

  const [section, setSection] = useState<Section>('locations');
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employeeLocationMap, setEmployeeLocationMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AttendanceLocation | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScope, setBulkScope] = useState<AttendanceLocationScope>('all');
  const [bulkLocationIds, setBulkLocationIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    if (!companyId) {
      setError('No active company session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      loadLocations(companyId),
      employeeService.getAll(),
      loadAllEmployeeLocationMap(),
      departmentService.getAll(),
      designationService.getAll(),
    ])
      .then(([locationRows, employeeRows, map, departmentRows, designationRows]) => {
        setLocations(locationRows);
        setEmployees(employeeRows.filter((e) => e.company_id === companyId && e.active));
        setEmployeeLocationMap(map);
        setDepartments(departmentRows.filter((d) => d.company_id === companyId));
        setDesignations(designationRows.filter((d) => d.company_id === companyId));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load geofencing data.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function handleSaveLocation(data: { name: string; type: LocationType; address: string; lat: number; lng: number; radius: number }) {
    setSavingLocation(true);
    try {
      if (editingLocation) {
        await saveLocation(editingLocation.id, {
          location_name: data.name,
          location_type: data.type,
          address: data.address,
          latitude: data.lat,
          longitude: data.lng,
          radius_meters: data.radius,
        });
      } else {
        await createLocation({
          company_id: companyId,
          branch_id: null,
          location_name: data.name,
          location_type: data.type,
          address: data.address,
          latitude: data.lat,
          longitude: data.lng,
          radius_meters: data.radius,
          active: true,
        });
      }
      setLocationDialogOpen(false);
      setEditingLocation(null);
      fetchAll();
      showToast('Location saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save location.');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeletingLocation(true);
    try {
      await removeLocation(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
      showToast('Location removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete location.');
    } finally {
      setDeletingLocation(false);
    }
  }

  // ── Employee filtering + bulk selection ───────────────────────────────────

  const filteredDesignations = departmentFilter === 'all'
    ? designations
    : designations.filter((d) => d.department_id === departmentFilter);

  const filteredEmployees = employees.filter((e) => {
    if (departmentFilter !== 'all' && e.department_id !== departmentFilter) return false;
    if (designationFilter !== 'all' && e.designation_id !== designationFilter) return false;
    const kw = employeeSearch.trim().toLowerCase();
    if (!kw) return true;
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(kw) || e.employee_code.toLowerCase().includes(kw);
  });

  const allFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredEmployees.forEach((e) => next.delete(e.id));
      } else {
        filteredEmployees.forEach((e) => next.add(e.id));
      }
      return next;
    });
  }

  function toggleSelect(employeeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId); else next.add(employeeId);
      return next;
    });
  }

  function toggleBulkLocation(locationId: string) {
    setBulkLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId); else next.add(locationId);
      return next;
    });
  }

  async function handleApplyToSelected() {
    if (selectedIds.size === 0) return;
    setApplying(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map(async (employeeId) => {
          await setEmployeeScope(employeeId, bulkScope);
          await setEmployeeLocations(employeeId, bulkScope === 'specific' ? Array.from(bulkLocationIds) : []);
        })
      );
      showToast(`Updated ${ids.length} employee${ids.length === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      setBulkLocationIds(new Set());
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update selected employees.');
    } finally {
      setApplying(false);
    }
  }

  function scopeSummary(emp: Employee): string {
    if (emp.attendance_location_scope === 'all') return 'All Locations';
    const count = (employeeLocationMap[emp.id] ?? []).length;
    return count > 0 ? `${count} specific location${count === 1 ? '' : 's'}` : 'Specific (none set)';
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Attendance Geofencing</h2>
        <p className="text-sm text-slate-500">
          Add named locations — office, a project site, anywhere training happens — then decide which employees must
          check in from which location(s). No locations configured means no restriction.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setSection('locations')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${section === 'locations' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Locations
          </button>
          <button
            onClick={() => setSection('employees')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${section === 'employees' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Employee Assignment
          </button>
        </div>
      </div>

      {section === 'locations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <PrimaryButton onClick={() => { setEditingLocation(null); setLocationDialogOpen(true); }}>
              <IconPlus className="h-4 w-4" /> Add Location
            </PrimaryButton>
          </div>

          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
              <IconMapPin className="h-8 w-8 text-slate-300" />
              <p className="font-medium">No locations yet</p>
              <p className="text-sm">Add your office or a training site to start restricting check-in by location.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((loc) => (
                <div key={loc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{loc.location_name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE_CLS[loc.location_type]}`}>
                        {LOCATION_TYPE_LABELS[loc.location_type]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Radius: {loc.radius_meters}m</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <SecondaryButton onClick={() => { setEditingLocation(loc); setLocationDialogOpen(true); }}>
                      <IconPencil /> Edit
                    </SecondaryButton>
                    <DangerButton onClick={() => setDeleteTarget(loc)}>
                      <IconTrash /> Delete
                    </DangerButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search by name or code…"
              className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
            />
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setDesignationFilter('all'); }}
              className={`w-auto min-w-[160px] ${INPUT_CLS}`}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.department_name}</option>))}
            </select>
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className={`w-auto min-w-[160px] ${INPUT_CLS}`}
            >
              <option value="all">All Designations</option>
              {filteredDesignations.map((d) => (<option key={d.id} value={d.id}>{d.designation_name}</option>))}
            </select>
          </div>

          {locations.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Add at least one location first — assignment has nothing to point at yet.
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                disabled={filteredEmployees.length === 0}
                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all (${filteredEmployees.length})`}
              </span>
            </div>

            {filteredEmployees.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No employees found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <label key={emp.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-400">{emp.employee_code}</p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SCOPE_BADGE_CLS[emp.attendance_location_scope]}`}>
                      {scopeSummary(emp)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-lg">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                Set check-in policy for {selectedIds.size} selected employee{selectedIds.size === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={bulkScope}
                  onChange={(e) => setBulkScope(e.target.value as AttendanceLocationScope)}
                  className={`w-auto ${INPUT_CLS}`}
                >
                  {(Object.keys(ATTENDANCE_SCOPE_LABELS) as AttendanceLocationScope[]).map((s) => (
                    <option key={s} value={s}>{ATTENDANCE_SCOPE_LABELS[s]}</option>
                  ))}
                </select>

                {bulkScope === 'specific' && (
                  <div className="flex flex-wrap gap-2">
                    {locations.map((loc) => {
                      const checked = bulkLocationIds.has(loc.id);
                      return (
                        <label
                          key={loc.id}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${checked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleBulkLocation(loc.id)} className="hidden" />
                          {loc.location_name}
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="ml-auto flex gap-2">
                  <SecondaryButton onClick={() => { setSelectedIds(new Set()); setBulkLocationIds(new Set()); }} disabled={applying}>
                    Clear
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={handleApplyToSelected}
                    disabled={applying || (bulkScope === 'specific' && bulkLocationIds.size === 0)}
                  >
                    {applying ? <IconSpinner className="h-3.5 w-3.5" /> : null} Apply
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {locationDialogOpen && (
        <LocationDialog
          editing={editingLocation}
          saving={savingLocation}
          onSave={handleSaveLocation}
          onCancel={() => { setLocationDialogOpen(false); setEditingLocation(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.location_name}
          busy={deletingLocation}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default GeofenceManagement;
