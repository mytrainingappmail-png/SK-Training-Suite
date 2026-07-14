import type { User } from '../../types/app';

const SESSION_KEY = 'SK_TRAINING_SESSION';

let cache: User | null = null;

/** Save user to memory and localStorage. */
export function setCurrentUser(user: User): void {
  cache = user;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    console.warn('[session] localStorage.setItem failed — session is memory-only.');
  }
}

/** Return the in-memory user. Call loadCurrentUser() on app boot first. */
export function getCurrentUser(): User | null {
  return cache;
}

/**
 * Read from localStorage, restore the in-memory cache, and return the user.
 * Returns null when no valid session exists.
 * Call this once inside AuthorizationProvider on mount.
 */
export function loadCurrentUser(): User | null {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as User;

    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    cache = parsed;
    return cache;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/** Clear memory and remove localStorage entry. */
export function clearCurrentUser(): void {
  cache = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    console.warn('[session] localStorage.removeItem failed.');
  }
}

/** Alias for backward compatibility. */
export function logout(): void {
  clearCurrentUser();
}
