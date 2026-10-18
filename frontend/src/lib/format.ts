const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const compactCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
// Short axis labels in Indian units: ₹500, ₹1.2K, ₹1.5L, ₹2Cr
const axisCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatCurrency = (amount: number | string) => currencyFormatter.format(Number(amount));
export const formatCurrencyRounded = (amount: number | string) =>
  compactCurrencyFormatter.format(Number(amount));
export const formatCurrencyAxis = (amount: number) => axisCurrencyFormatter.format(amount);

// Parse 'YYYY-MM-DD' as a *local* calendar date. new Date('2026-10-18') would be UTC midnight,
// which shows as the previous day in timezones west of UTC.
function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const formatDate = (value: string) => dateFormatter.format(parseLocalDate(value));

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Today's date as 'YYYY-MM-DD' in the user's timezone (toISOString() would give the UTC date)
export function todayISO(): string {
  return toISODate(new Date());
}

const weekdayFormatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const weekdayYearFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

// List group heading: "Today", "Yesterday", "Fri, 16 Oct" (year added when not the current year)
export function formatDayHeading(value: string): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (value === toISODate(today)) return 'Today';
  if (value === toISODate(yesterday)) return 'Yesterday';
  const d = parseLocalDate(value);
  return (d.getFullYear() === today.getFullYear() ? weekdayFormatter : weekdayYearFormatter).format(d);
}

const monthShort = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

export interface MonthSlot {
  key: string;   // 'YYYY-MM-01' — matches month_date from /analytics/monthly
  short: string; // 'Oct'
  long: string;  // 'October 2026'
}

// The last `count` calendar months ending with the current one, oldest first
export function lastMonths(count: number): MonthSlot[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: toISODate(d), short: monthShort.format(d), long: monthLong.format(d) };
  });
}

export const formatPercent = (ratio: number) =>
  `${(ratio * 100).toFixed(Math.abs(ratio) < 0.1 && ratio !== 0 ? 1 : 0)}%`;
