import { Link, NavLink } from 'react-router';
import { useAuth } from '../context/auth-context';
import { useTheme, type ThemePreference } from '../context/theme-context';
import { NAV_ITEMS } from '../nav';
import { LogoutIcon, MonitorIcon, MoonIcon, SunIcon } from './Icons';

// Clicking cycles system → light → dark
const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemePreference, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const ThemeIcon = ICON[preference];
  const name = user?.display_name || user?.username || '';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="brand" to="/" aria-label="Pennywise home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>Pennywise</span>
        </Link>

        <nav className="header-nav" aria-label="Main">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className="header-nav-link">
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setPreference(NEXT[preference])}
          aria-label={`${LABEL[preference]} (switch to ${LABEL[NEXT[preference]].toLowerCase()})`}
          title={LABEL[preference]}
        >
          <ThemeIcon />
        </button>

        <span className="header-divider" aria-hidden="true" />

        <div className="user-chip">
          <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          <span className="user-name">{name}</span>
        </div>

        <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
