import { Link } from 'react-router';
import { useBudgets } from '../hooks/useFinanceData';
import { toMonthKey } from '../lib/budget';
import BudgetBar from './BudgetBar';

const SHOWN = 4;

// Dashboard card: this month's budgets closest to (or over) their limit
export default function BudgetOverview() {
  const month = toMonthKey(new Date());
  const { data, isPending } = useBudgets(month);

  const items = [...(data?.items ?? [])]
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
    .slice(0, SHOWN);

  return (
    <section className="card" aria-labelledby="budget-overview-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="budget-overview-title">Budgets</h2>
          <p className="card-subtitle">This month</p>
        </div>
        <Link to="/budgets" className="btn btn-ghost">Manage</Link>
      </div>
      <div className="card-body">
        {isPending ? (
          <div className="skeleton" style={{ height: 180 }} aria-hidden="true" />
        ) : items.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 8px' }}>
            <span className="empty-state-icon" aria-hidden="true">🎯</span>
            <p>Set a monthly limit for food, shopping or anything else, and see how you're tracking.</p>
            <Link to="/budgets" className="btn btn-secondary">Set a budget</Link>
          </div>
        ) : (
          <div className="budget-stack">
            {items.map((b) => (
              <BudgetBar key={b.category_id} name={b.name} icon={b.icon} spent={b.spent} budget={b.budget} compact />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
