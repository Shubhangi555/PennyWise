import { useMonthly, useSummary } from '../hooks/useFinanceData';
import { formatCurrency, formatPercent, lastMonths } from '../lib/format';
import { ArrowDownIcon, ArrowUpIcon } from './Icons';

// "↑ 12% vs Sep" — arrow + words carry the meaning; colour stays neutral text
function Change({ current, previous, prevLabel }: { current: number; previous: number; prevLabel: string }) {
  if (previous === 0) {
    return <p className="stat-meta">{current === 0 ? 'Nothing yet this month' : `Nothing in ${prevLabel} to compare`}</p>;
  }
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.005) return <p className="stat-meta">Same as {prevLabel}</p>;
  const Arrow = ratio > 0 ? ArrowUpIcon : ArrowDownIcon;
  return (
    <p className="stat-meta">
      <Arrow />
      <span>
        {formatPercent(Math.abs(ratio))} {ratio > 0 ? 'more' : 'less'} than {prevLabel}
      </span>
    </p>
  );
}

function StatSkeleton() {
  return (
    <div className="card stat" aria-hidden="true">
      <div className="skeleton" style={{ width: 90, height: 14 }} />
      <div className="skeleton" style={{ width: 150, height: 30, marginTop: 10 }} />
      <div className="skeleton" style={{ width: 120, height: 13, marginTop: 10 }} />
    </div>
  );
}

export default function SummaryCards() {
  const summary = useSummary();
  const monthly = useMonthly();

  if (summary.isPending || monthly.isPending) {
    return (
      <section className="stat-grid" aria-busy="true" aria-label="Loading summary">
        <StatSkeleton /><StatSkeleton /><StatSkeleton />
      </section>
    );
  }

  const [prev, current] = lastMonths(2);
  const byMonth = new Map((monthly.data ?? []).map((m) => [m.month_date, m]));
  const thisMonth = byMonth.get(current.key) ?? { income: 0, expense: 0 };
  const lastMonth = byMonth.get(prev.key) ?? { income: 0, expense: 0 };
  const balance = summary.data?.total_savings ?? 0;
  const savedThisMonth = thisMonth.income - thisMonth.expense;

  return (
    <section className="stat-grid" aria-label="Summary">
      <div className="card stat hero">
        <p className="stat-label">Balance</p>
        <p className="stat-value">{formatCurrency(balance)}</p>
        <p className="stat-meta">
          {thisMonth.income > 0 || thisMonth.expense > 0
            ? `${savedThisMonth >= 0 ? 'Saved' : 'Overspent'} ${formatCurrency(Math.abs(savedThisMonth))} this month`
            : 'All-time income minus spending'}
        </p>
      </div>

      <div className="card stat">
        <p className="stat-label">
          <span className="stat-dot" style={{ background: 'var(--chart-income)' }} aria-hidden="true" />
          Income · {current.short}
        </p>
        <p className="stat-value">{formatCurrency(thisMonth.income)}</p>
        <Change current={thisMonth.income} previous={lastMonth.income} prevLabel={prev.short} />
      </div>

      <div className="card stat">
        <p className="stat-label">
          <span className="stat-dot" style={{ background: 'var(--chart-expense)' }} aria-hidden="true" />
          Spent · {current.short}
        </p>
        <p className="stat-value">{formatCurrency(thisMonth.expense)}</p>
        <Change current={thisMonth.expense} previous={lastMonth.expense} prevLabel={prev.short} />
      </div>
    </section>
  );
}
