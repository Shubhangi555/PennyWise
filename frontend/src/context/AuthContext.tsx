import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setUnauthorizedHandler } from '../api/axios';
import { loadAuth, saveAuth, clearAuth, type AuthState, type User } from '../lib/authStorage';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthState>(loadAuth); // restore session on page refresh

  const login = useCallback((token: string, user: User) => {
    const { id, username, display_name } = user; // persist only what the UI needs
    const state = { token, user: { id, username, display_name } };
    saveAuth(state);
    setAuth(state);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuth({ user: null, token: null });
    queryClient.clear(); // drop cached data so the next user never sees the previous one's
  }, [queryClient]);

  // Expired/invalid token on any API call → back to the login screen
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Keep tabs in sync: logging out (or in) in one tab applies to the others
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'expense_auth') {
        const next = loadAuth();
        setAuth(next);
        if (!next.token) queryClient.clear();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  const value = useMemo(() => ({ ...auth, login, logout }), [auth, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
