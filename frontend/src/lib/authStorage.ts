export interface User {
  id: string;
  username: string;
  display_name: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

const STORAGE_KEY = 'expense_auth';
const EMPTY: AuthState = { user: null, token: null };

// Read persisted auth. Only whitelisted user fields are kept, which also scrubs the
// password_hash that older backend versions accidentally returned and we stored.
export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.token || !parsed.user?.id) return EMPTY;
    const { id, username, display_name } = parsed.user;
    return { token: parsed.token, user: { id, username, display_name } };
  } catch {
    return EMPTY; // corrupted JSON or storage unavailable (e.g. private mode) → logged out
  }
}

export function saveAuth(state: AuthState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/blocked: the session still works until the tab is closed
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing persisted to clear
  }
}
