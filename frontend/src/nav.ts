import { HomeIcon, ListIcon, TagIcon, TargetIcon } from './components/Icons';

// Main navigation — header links on desktop, bottom tab bar on mobile
export const NAV_ITEMS = [
  { to: '/', label: 'Overview', Icon: HomeIcon },
  { to: '/transactions', label: 'Transactions', Icon: ListIcon },
  { to: '/budgets', label: 'Budgets', Icon: TargetIcon },
  { to: '/categories', label: 'Categories', Icon: TagIcon },
] as const;
