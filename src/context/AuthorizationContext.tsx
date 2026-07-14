// File: src/context/AuthorizationContext.tsx
//
// Fix: calls loadCurrentUser() on mount so that a persisted localStorage
// session is detected immediately — even before login() is called in this
// render cycle.  refresh() re-runs the same load so LoginForm's
// navigate('/dashboard') triggers a fresh authorization check with the
// newly stored user.
//
// Verified imports:
//   react                                          — built-in
//   ../services/authorization/authorizationService → resolveAuthorization
//   ../services/auth/session                       → loadCurrentUser
//   ../types/authorization                         → AuthorizationContextValue, AuthorizationData

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { resolveAuthorization } from '../services/authorization/authorizationService';
import { loadCurrentUser }      from '../services/auth/session';

import type { AuthorizationContextValue } from '../types/authorization';
import type { AuthorizationData }         from '../types/authorization';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthorizationContext =
  createContext<AuthorizationContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthorizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data,    setData]    = useState<AuthorizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [ready,   setReady]   = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // Hydrate the in-memory session cache from localStorage before
      // resolveAuthorization() calls getCurrentUser().  This is the
      // fix: without this call, getCurrentUser() returns null on first
      // mount (page load / browser refresh) and after login navigation.
      loadCurrentUser();

      const resolved = await resolveAuthorization();

      if (!mounted.current) return;
      setData(resolved);
      setReady(true);
    } catch (err) {
      if (!mounted.current) return;
      console.error('[AuthorizationProvider]', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load authorization.'
      );
      setData(null);
      setReady(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Run once on mount — reads whatever is in localStorage.
  useEffect(() => {
    load();
  }, [load]);

  // refresh() is called after login navigation so ProtectedRoute sees
  // the new user without requiring a full page reload.
  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return (
    <AuthorizationContext.Provider
      value={{ data, loading, error, ready, refresh }}
    >
      {children}
    </AuthorizationContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal accessor — consumed only by useAuthorization hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuthorizationContext(): AuthorizationContextValue {
  const ctx = useContext(AuthorizationContext);
  if (!ctx) {
    throw new Error(
      'useAuthorizationContext must be used inside <AuthorizationProvider>.'
    );
  }
  return ctx;
}
