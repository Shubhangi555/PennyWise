import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from './theme-context';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function loadPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // storage blocked → follow the OS
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadPreference);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  // Track OS light/dark changes while the app is open
  useEffect(() => {
    const mq = darkQuery();
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    // Apply to <html> synchronously (not in an effect) so components that read resolved CSS
    // variables during the next render — e.g. chart colours — see the new theme.
    // 'system' = no attribute, so the CSS media query decides.
    const root = document.documentElement;
    if (p === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', p);
    setPreferenceState(p);
    try {
      if (p === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      // not persisted; still applies for this session
    }
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // Keep the mobile browser address-bar colour in step with the theme
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0e0e14' : '#4338ca');
  }, [resolved]);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
