import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme, type ResolvedTheme } from '../context/theme-context';
import { useByCategory, useMonthly } from '../hooks/useFinanceData';
import { formatCurrency, formatCurrencyAxis, formatPercent, lastMonths } from '../lib/format';
import { ChartIcon, TableIcon } from './Icons';

const MONTHS_SHOWN = 6;

// Recharts draws SVG attributes, which can't use CSS var() directly — resolve the
// current theme's tokens. Re-read whenever the theme changes.
function readChartColors(theme: ResolvedTheme) {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    theme,
    income: v('--chart-income'),
    expense: v('--chart-expense'),
    grid: v('--chart-grid'),
    axis: v('--chart-axis'),
    cursor: v('--track'),
  };
}

function ChartSkeleton() {
  return <div className="skeleton" style={{ height: 240 }} aria-hidden="true" />;
}

// ─── Monthly income vs spending ─────────────────────────────────────────────
function MonthlyChart() {
  const { data, isPending } = useMonthly();
  const { resolved } = useTheme();
  const colors = useMemo(() => readChartColors(resolved), [resolved]);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  // Fixed 6-month window, zero-filled, so the axis never jumps around
  const rows = useMemo(() => {
    const byMonth = new Map((data ?? []).map((m) => [m.month_date, m]));
    return lastMonths(MONTHS_SHOWN).map((slot) => ({
      ...slot,
      income: byMonth.get(slot.key)?.income ?? 0,
      expense: byMonth.get(slot.key)?.expense ?? 0,
    }));
  }, [data]);
  const hasData = rows.some((r) => r.income > 0 || r.expense > 0);

  return (
    <section className="card" aria-labelledby="monthly-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="monthly-title">Income vs spending</h2>
          <p className="card-subtitle">Last {MONTHS_SHOWN} months</p>
        </div>
        {hasData && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            aria-label={view === 'chart' ? 'Show as table' : 'Show as chart'}
            title={view === 'chart' ? 'Show as table' : 'Show as chart'}
          >
            {view === 'chart' ? <TableIcon /> : <ChartIcon />}
          </button>
        )}
      </div>
      <div className="card-body">
        {isPending ? (
          <ChartSkeleton />
        ) : !hasData ? (
          <div className="chart-empty">No activity in the last {MONTHS_SHOWN} months yet.</div>
        ) : view === 'table' ? (
          <table className="data-table">
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Spent</th><th scope="col">Net</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" style={{ fontWeight: 500 }}>{r.long}</th>
                  <td>{formatCurrency(r.income)}</td>
                  <td>{formatCurrency(r.expense)}</td>
                  <td>{formatCurrency(r.income - r.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <div className="chart-legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: colors.income }} />Income</span>
              <span><i style={{ background: colors.expense }} />Spent</span>
            </div>
            <div className="chart-box" role="img" aria-label="Bar chart of monthly income and spending. Use the table button for exact values.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis
                    dataKey="short"
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={formatCurrencyAxis}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    width={60}
                  />
                  <Tooltip
                    cursor={{ fill: colors.cursor, radius: 6 }}
                    content={({ active, payload }) => {
                      const row = active ? payload?.[0]?.payload : null;
                      if (!row) return null;
                      return (
                        <div className="chart-tooltip">
                          <p className="chart-tooltip-title">{row.long}</p>
                          <p className="chart-tooltip-row"><span><i style={{ background: colors.income }} />Income</span><b>{formatCurrency(row.income)}</b></p>
                          <p className="chart-tooltip-row"><span><i style={{ background: colors.expense }} />Spent</span><b>{formatCurrency(row.expense)}</b></p>
                          <p className="chart-tooltip-row" style={{ marginTop: 4 }}><span>Net</span><b>{formatCurrency(row.income - row.expense)}</b></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Spent" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Spending by category (ranked list — easier to compare than a pie) ──────
function CategoryBreakdown() {
  const { data, isPending } = useByCategory();

  // Every category is listed (largest first); the list scrolls inside the card when it's long
  const { items, total } = useMemo(() => {
    const sorted = [...(data ?? [])].sort((a, b) => b.total - a.total);
    return { items: sorted, total: sorted.reduce((sum, c) => sum + c.total, 0) };
  }, [data]);
  const max = Math.max(...items.map((c) => c.total), 1);

  return (
    <section className="card" aria-labelledby="categories-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="categories-title">Where your money goes</h2>
          <p className="card-subtitle">
            All-time spending{items.length > 0 ? ` · ${items.length} ${items.length === 1 ? 'category' : 'categories'}` : ''}
          </p>
        </div>
      </div>
      <div className="card-body">
        {isPending ? (
          <ChartSkeleton />
        ) : items.length === 0 ? (
          <div className="chart-empty">Your spending categories will show up here.</div>
        ) : (
          // scroll-fill: the list takes the card's height (set by the chart beside it) and scrolls inside
          <div className="scroll-fill">
            <ul className="cat-list scroll-inner" tabIndex={0} aria-label="Spending by category">
              {items.map((c) => (
                <li key={c.name} className="cat-row">
                  <span className="cat-icon" aria-hidden="true">{c.icon}</span>
                  <span className="cat-name">
                    {c.name}
                    <span className="cat-pct">{formatPercent(c.total / total)}</span>
                  </span>
                  <span className="cat-amount">{formatCurrency(c.total)}</span>
                  <span className="cat-bar" aria-hidden="true">
                    <span style={{ width: `${(c.total / max) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Charts() {
  return (
    <div className="chart-grid">
      <MonthlyChart />
      <CategoryBreakdown />
    </div>
  );
}
