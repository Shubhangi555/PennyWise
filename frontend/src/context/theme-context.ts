import { createContext, useContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme; // what's actually showing (system resolved via the OS setting)
  setPreference: (p: ThemePreference) => void;
}

// Must match the inline script in index.html that applies the theme before first paint
export const THEME_STORAGE_KEY = 'pennywise_theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
