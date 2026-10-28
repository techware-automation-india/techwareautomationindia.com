import { setToken, clearToken } from "./api.js";

const USER_KEY = "authUser";

// Returns the stored authenticated user, or null.
export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Persist token + user after a successful login.
export function saveAuth(token, user) {
  setToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Update just the stored user (e.g. after onboarding status changes).
export function updateAuthUser(partial) {
  const current = getAuthUser() || {};
  const next = { ...current, ...partial };
  localStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
}

// Clear everything on logout.
export function clearAuth() {
  clearToken();
  localStorage.removeItem(USER_KEY);
}
