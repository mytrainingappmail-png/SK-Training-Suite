import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadMenusByRole,
  saveMenuPermissions,
} from "../../services/menuPermission/menuPermissionService";
import { loadRoles } from "../../services/role/roleService";
import { loadMenus } from "../../services/menu/menuService";

import type { Role }           from "../../types/role";
import type { Menu, MenuLevel } from "../../types/menu";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function levelLabel(level: MenuLevel): string {
  const map: Record<MenuLevel, string> = {
    1: "Level 1 — Top",
    2: "Level 2 — Sub",
    3: "Level 3 — Nested",
  };
  return map[level] ?? `Level ${level}`;
}

function levelCls(level: MenuLevel): string {
  const map: Record<MenuLevel, string> = {
    1: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    2: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    3: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  };
  return map[level] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ spin }: { spin: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function MenuPermissionManagement() {

  const [roles,      setRoles]      = useState<Role[]>([]);
  const [menus,      setMenus]      = useState<Menu[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [assignedIds,    setAssignedIds]     = useState<Set<string>>(new Set());
  const [pendingIds,     setPendingIds]      = useState<Set<string>>(new Set());
  const [menuSearch,     setMenuSearch]      = useState("");

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [banner,      setBanner]      = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const saveRef = useRef<HTMLButtonElement>(null);

  // ── Load roles + menus once
  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setBanner(null);
    try {
      const [rData, mData] = await Promise.all([
        loadRoles(),
        loadMenus(),
      ]);
      setRoles(rData);
      setMenus(mData);
    } catch (err) {
      console.error(err);
      setBanner({ type: "error", msg: "Failed to load data. Please refresh." });
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // ── Load assigned menus when role changes
  useEffect(() => {
    if (!selectedRoleId) {
      setAssignedIds(new Set());
      setPendingIds(new Set());
      return;
    }

    let cancelled = false;
    setLoadingRole(true);
    setBanner(null);

    loadMenusByRole(selectedRoleId)
      .then((mps) => {
        if (cancelled) return;
        const ids = new Set(mps.map((mp) => mp.menu_id));
        setAssignedIds(ids);
        setPendingIds(new Set(ids));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setBanner({ type: "error", msg: "Failed to load role menus." });
      })
      .finally(() => {
        if (!cancelled) setLoadingRole(false);
      });

    return () => { cancelled = true; };
  }, [selectedRoleId]);

  // ── Derived: menus grouped by level, filtered by search
  const grouped = useMemo(() => {
    const kw = menuSearch.trim().toLowerCase();
    const filtered = kw
      ? menus.filter(
          (m) =>
            m.menu_name.toLowerCase().includes(kw) ||
            m.menu_code.toLowerCase().includes(kw) ||
            m.route_path.toLowerCase().includes(kw)
        )
      : menus;

    const map = new Map<MenuLevel, Menu[]>();
    for (const m of filtered) {
      const group = map.get(m.menu_level) ?? [];
      group.push(m);
      map.set(m.menu_level, group);
    }
    // Sort keys 1 → 3
    return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
  }, [menus, menuSearch]);

  const totalMenus    = menus.length;
  const selectedCount = pendingIds.size;

  const isDirty = useMemo(() => {
    if (pendingIds.size !== assignedIds.size) return true;
    for (const id of pendingIds) {
      if (!assignedIds.has(id)) return true;
    }
    return false;
  }, [pendingIds, assignedIds]);

  // ── Toggle single menu
  function toggleMenu(menuId: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  }

  // ── Toggle whole level
  function toggleLevel(levelMenus: Menu[]) {
    const allChecked = levelMenus.every((m) => pendingIds.has(m.id));
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        levelMenus.forEach((m) => next.delete(m.id));
      } else {
        levelMenus.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  // ── Select / Clear all visible
  function selectAllVisible() {
    const ids: string[] = [];
    grouped.forEach((ms) => ms.forEach((m) => ids.push(m.id)));
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearAllVisible() {
    const ids = new Set<string>();
    grouped.forEach((ms) => ms.forEach((m) => ids.add(m.id)));
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  // ── Save
  async function handleSave() {
    if (!selectedRoleId) return;
    setSaving(true);
    setBanner(null);
    try {
      await saveMenuPermissions(selectedRoleId, Array.from(pendingIds));
      setAssignedIds(new Set(pendingIds));
      setBanner({ type: "success", msg: "Menu permissions saved successfully." });
    } catch (err) {
      setBanner({ type: "error", msg: err instanceof Error ? err.message : "Unable to save menu permissions." });
    } finally {
      setSaving(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Menu Permission Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Control which menu items each role can access.
          </p>
        </div>
        <button onClick={loadMeta} disabled={loadingMeta} aria-label="Refresh"
          className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50">
          <Spinner spin={loadingMeta} />
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`mx-6 mt-4 flex items-start gap-3 rounded-xl border p-4 text-sm ${
          banner.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {banner.type === "success" ? (
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          )}
          <p className="flex-1">{banner.msg}</p>
          <button onClick={() => setBanner(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">

        {/* ── Role selection ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Select Role <span className="text-red-500">*</span>
            </label>
            {loadingMeta ? (
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <select
                value={selectedRoleId}
                onChange={(e) => {
                  setSelectedRoleId(e.target.value);
                  setBanner(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
              >
                <option value="">— Select a Role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role_name} ({r.role_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedRole && (
            <div className="flex items-end">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{selectedCount}</span> of{" "}
                <span className="font-medium text-slate-800">{totalMenus}</span> menus selected
              </div>
            </div>
          )}
        </div>

        {/* ── Menu panel ── */}
        {!selectedRoleId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Select a role to manage its menu access</p>
          </div>
        ) : loadingRole ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-4">
                <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <div key={j} className="h-8 rounded bg-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menus…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
                />
                {menuSearch && (
                  <button onClick={() => setMenuSearch("")} aria-label="Clear"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <button onClick={selectAllVisible}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95">
                Select All
              </button>
              <button onClick={clearAllVisible}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95">
                Clear All
              </button>
            </div>

            {/* Grouped menu list */}
            {grouped.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-slate-500">
                  {menuSearch ? `No menus match "${menuSearch}".` : "No menus found."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(grouped.entries()).map(([level, levelMenus]) => {
                  const allChecked  = levelMenus.every((m) => pendingIds.has(m.id));
                  const someChecked = levelMenus.some((m) => pendingIds.has(m.id));

                  return (
                    <div key={level} className="rounded-xl border border-slate-200 bg-white">
                      {/* Level header */}
                      <div
                        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                        onClick={() => toggleLevel(levelMenus)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Toggle all ${levelLabel(level)} menus`}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleLevel(levelMenus); } }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                            allChecked
                              ? "border-yellow-500 bg-yellow-500"
                              : someChecked
                              ? "border-yellow-400 bg-yellow-100"
                              : "border-slate-300 bg-white"
                          }`}>
                            {allChecked && (
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                            {!allChecked && someChecked && (
                              <div className="h-1.5 w-1.5 rounded-sm bg-yellow-500" />
                            )}
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelCls(level)}`}>
                            {levelLabel(level)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            {levelMenus.filter((m) => pendingIds.has(m.id)).length}/{levelMenus.length}
                          </span>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div className="grid grid-cols-1 gap-1 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {levelMenus.map((menu) => {
                          const checked = pendingIds.has(menu.id);
                          return (
                            <label
                              key={menu.id}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm transition select-none ${
                                checked
                                  ? "bg-yellow-50 text-yellow-900"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                              onClick={() => toggleMenu(menu.id)}
                            >
                              <div
                                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                                  checked
                                    ? "border-yellow-500 bg-yellow-500"
                                    : "border-slate-300 bg-white"
                                }`}
                                role="checkbox"
                                aria-checked={checked}
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMenu(menu.id); } }}
                              >
                                {checked && (
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium leading-snug">{menu.menu_name}</p>
                                <p className="font-mono text-xs text-slate-400 truncate">{menu.menu_code}</p>
                                <p className="font-mono text-xs text-slate-400 truncate">{menu.route_path}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save bar */}
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">
                {isDirty ? (
                  <span className="font-medium text-amber-600">You have unsaved changes.</span>
                ) : (
                  <span>All changes saved.</span>
                )}
              </p>
              <button
                ref={saveRef}
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              >
                {saving ? (
                  <>
                    <Spinner spin />
                    Saving…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
