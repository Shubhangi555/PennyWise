import { createContext, useContext } from 'react';
import type { AuthState, User } from '../lib/authStorage';

export interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
}

// Kept separate from AuthProvider so that file only exports a component (needed for Fast Refresh)
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
