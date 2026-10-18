import { formatCurrency } from './format';

export type BudgetLevel = 'ok' | 'warning' | 'over';

export const WARNING_RATIO = 0.8; // "almost there" from 80% of the limit

// Status for one budget. The label always spells the state out in words, so meaning
// never depends on the bar colour alone.
export function budgetStatus(spent: number, budget: number) {
  const ratio = budget > 0 ? spent / budget : 0;
  const level: BudgetLevel = spent > budget ? 'over' : ratio >= WARNING_RATIO ? 'warning' : 'ok';
  const label =
    level === 'over'
      ? `Over by ${formatCurrency(spent - budget)}`
      : `${formatCurrency(budget - spent)} left`;
  return { ratio, level, label };
}

// 'YYYY-MM' for a Date (local time)
export const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}

const monthTitle = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
export function formatMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthTitle.format(new Date(y, m - 1, 1));
}
