// File: src/components/dashboard/Header.tsx
//
// Verified imports:
//   react                           — useState, useRef, useEffect
//   react-router-dom                — useNavigate (installed)
//   ../../config/branding           — BRAND (exists)
//   ../../constants/routes          — ROUTES (exists)
//   ../../hooks/useAuthorization    — useAuthorization (exists, exports: user, refresh)
//   ../../services/auth/session     — clearCurrentUser (exists)

import { useEffect, useRef, useState } from 'react';
import { useNavigate }                 from 'react-router-dom';

import { BRAND }                from '../../config/branding';
import { ROUTES }               from '../../constants/routes';
import { useAuthorization }     from '../../hooks/useAuthorization';
import { clearCurrentUser }     from '../../services/auth/session';
import { loadBranding }         from '../../services/branding/brandingService';
import ProfileDrawer from '../profile/ProfileDrawer';
import NotificationBell from '../notifications/NotificationBell';

function Header() {
  const navigate           = useNavigate();
  const { user, refresh }  = useAuthorization();
  const [open, setOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef        = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState(BRAND.companyName);

  useEffect(() => {
    loadBranding().then((b) => setCompanyName(b.companyName));
  }, []);

  // Derive display values from session user
  const firstName   = user?.firstName  ?? '';
  const lastName    = user?.lastName   ?? '';
  const fullName    = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  const initials    = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || 'U';
  const employeeId  = user?.employeeId ?? '';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return ()  => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleKey);
    return ()  => document.removeEventListener('keydown', handleKey);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    // 1. Clear localStorage session
    clearCurrentUser();
    // 2. Reset authorization context so ProtectedRoute sees no user
    await refresh();
    // 3. Replace history entry — browser Back cannot return to dashboard
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8">

      {/* Left — page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Welcome to {companyName}
        </p>
      </div>

      {/* Right — notifications + profile dropdown */}
      <div className="flex items-center gap-4">

        {/* Notification bell */}
        <NotificationBell />

        {/* Profile section with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
            aria-haspopup="true"
            aria-expanded={open}
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm select-none">
              {initials}
            </div>

            {/* Name + role */}
            <div className="text-right hidden sm:block">
              <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                {fullName}
              </h3>
              <p className="text-xs text-slate-500 leading-tight">
                {employeeId}
              </p>
            </div>

            {/* Chevron */}
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 py-2 z-50">

              {/* User info header */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{fullName}</p>
                <p className="text-xs text-slate-500 truncate">{employeeId}</p>
              </div>

              {/* My Profile — disabled */}
              <button
    onClick={() => {
        setOpen(false);
        setProfileOpen(true);
    }}
    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition rounded-xl"
>
    <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
    </svg>

    My Profile
</button>

              <div className="my-1 border-t border-slate-100" />

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition rounded-xl mx-auto"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Logout
              </button>

            </div>
          )}
        </div>

      </div>
      <ProfileDrawer
    open={profileOpen}
    onClose={() => setProfileOpen(false)}
/>
    </header>
  );
}

export default Header;
