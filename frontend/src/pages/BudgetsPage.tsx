import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import BudgetBar from '../components/BudgetBar';
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { useAppActions } from '../context/app-actions';
import { useBudgets, useCategories } from '../hooks/useFinanceData';
import { budgetStatus, formatMonthKey, shiftMonth, toMonthKey } from '../lib/budget';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency } from '../lib/format';
import type { BudgetProgress } from '../types';

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { openAdd, showToast } = useAppActions();
  const currentMonth = toMonthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const { data, isPending, isError, refetch, isPlaceholderData } = useBudgets(month);
  const { data: categories = [] } = useCategories();

  const [editingId, setEditingId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: number; amount: number }) =>
      api.put(`/budgets/${categoryId}`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setEditingId(null);
    },
  });
  const removeMutation = useMutation({
    mutationFn: (b: BudgetProgress) => api.delete(`/budgets/${b.category_id}`),
    onSuccess: (_res, b) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      showToast(`Removed the ${b.name} budget`, {
        label: 'Undo',
        onClick: () => saveMutation.mutate({ categoryId: b.category_id, amount: b.budget }),
      });
    },
    onError: (err) => showToast(getErrorMessage(err, "Couldn't remove the budget")),
  });

  const items = data?.items ?? [];
  const totalBudget = items.reduce((s, b) => s + b.budget, 0);
  const budgetedSpent = items.reduce((s, b) => s + b.spent, 0);
  const unbudgeted = Math.max(0, (data?.total_spent ?? 0) - budgetedSpent);
  const overall = budgetStatus(budgetedSpent, totalBudget);
  const overCount = items.filter((b) => b.spent > b.budget).length;

  const available = categories.filter((c) => c.type === 'expense' && !items.some((b) => b.category_id === c.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p>Monthly limits per category. They repeat every month.</p>
        </div>
        <div className="month-switcher" role="group" aria-label="Month">
          <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeftIcon />
          </button>
          <span className="month-label" aria-live="polite">{formatMonthKey(month)}</span>
          <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRightIcon />
          </button>
          {month !== currentMonth && (
            <button type="button" className="btn btn-ghost" onClick={() => setMonth(currentMonth)}>Today</button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="alert-error load-error" role="alert">
          <span>Couldn't load your budgets.</span>
          <button type="button" className="btn btn-secondary" onClick={() => refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <section className="stat-grid" aria-label="Budget summary">
              <div className="card stat hero">
                <p className="stat-label">Left to spend</p>
                <p className="stat-value">{formatCurrency(Math.max(0, totalBudget - budgetedSpent))}</p>
                <p className="stat-meta">
                  {overall.level === 'over'
                    ? `${formatCurrency(budgetedSpent - totalBudget)} over your total budget`
                    : `of ${formatCurrency(totalBudget)} budgeted`}
                </p>
              </div>
              <div className="card stat">
                <p className="stat-label">Spent in budgeted categories</p>
                <p className="stat-value">{formatCurrency(budgetedSpent)}</p>
                <p className="stat-meta">
                  {overCount > 0 ? `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over` : 'All within limits'}
                </p>
              </div>
              <div className="card stat">
                <p className="stat-label">Other spending</p>
                <p className="stat-value">{formatCurrency(unbudgeted)}</p>
                <p className="stat-meta">In categories without a budget</p>
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="budgets-title" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            <div className="card-head">
              <h2 className="card-title" id="budgets-title">Category budgets</h2>
            </div>
            <div className="card-body">
              {isPending ? (
                <div className="skeleton" style={{ height: 200 }} aria-hidden="true" />
              ) : items.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 8px' }}>
                  <span className="empty-state-icon" aria-hidden="true">🎯</span>
                  <h3>No budgets yet</h3>
                  <p>Pick a category below and set how much you want to spend on it each month.</p>
                </div>
              ) : (
                <ul className="budget-list">
                  {items.map((b) => (
                    <li key={b.category_id} className="budget-item">
                      {editingId === b.category_id ? (
                        <BudgetForm
                          label={`${b.icon ?? ''} ${b.name}`}
                          initialAmount={b.budget}
                          pending={saveMutation.isPending}
                          error={saveMutation.isError ? getErrorMessage(saveMutation.error) : ''}
                          onCancel={() => setEditingId(null)}
                          onSave={(amount) => saveMutation.mutate({ categoryId: b.category_id, amount })}
                        />
                      ) : (
                        <>
                          <BudgetBar name={b.name} icon={b.icon} spent={b.spent} budget={b.budget} />
                          <div className="budget-actions">
                            <button type="button" className="icon-btn" title={`Add ${b.name} expense`} aria-label={`Add ${b.name} expense`}
                              onClick={() => openAdd({ type: 'expense', category_id: b.category_id })}>
                              <PlusIcon />
                            </button>
                            <button type="button" className="icon-btn" title="Change limit" aria-label={`Change ${b.name} budget`}
                              onClick={() => { saveMutation.reset(); setEditingId(b.category_id); }}>
                              <PencilIcon />
                            </button>
                            <button type="button" className="icon-btn danger" title="Remove budget" aria-label={`Remove ${b.name} budget`}
                              onClick={() => removeMutation.mutate(b)} disabled={removeMutation.isPending}>
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <AddBudget
            available={available}
            onAdded={(name) => {
              queryClient.invalidateQueries({ queryKey: ['budgets'] });
              showToast(`Budget set for ${name}`);
            }}
          />
        </>
      )}
    </>
  );
}

// Inline amount editor used when changing an existing limit
function BudgetForm({
  label, initialAmount, pending, error, onCancel, onSave,
}: {
  label: string;
  initialAmount: number;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState(String(initialAmount));
  const [localError, setLocalError] = useState('');
  return (
    <form
      className="budget-edit"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = Number(value);
        if (!(amount > 0)) return setLocalError('Enter an amount greater than zero.');
        onSave(amount);
      }}
    >
      <span className="budget-bar-name">{label}</span>
      <div className="amount-input amount-input-sm">
        <span aria-hidden="true">₹</span>
        <input className="input" type="number" min="1" step="1" inputMode="decimal" aria-label="Monthly limit"
          value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </div>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
      {(localError || error) && <p className="alert-error budget-edit-error" role="alert">{localError || error}</p>}
    </form>
  );
}

// "Add a budget": pick an expense category without one, enter a monthly limit
function AddBudget({ available, onAdded }: { available: { id: number; name: string; icon: string | null }[]; onAdded: (name: string) => void }) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.put(`/budgets/${categoryId}`, { amount: Number(amount) }),
    onSuccess: () => {
      onAdded(available.find((c) => String(c.id) === categoryId)?.name ?? 'category');
      setCategoryId('');
      setAmount('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (available.length === 0) {
    return (
      <p className="muted-note">
        Every expense category has a budget. <Link to="/categories">Add a category</Link> to budget for something new.
      </p>
    );
  }

  return (
    <section className="card" aria-labelledby="add-budget-title">
      <div className="card-head">
        <h2 className="card-title" id="add-budget-title">Add a budget</h2>
      </div>
      <form
        className="card-body add-budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          if (!categoryId) return setError('Pick a category.');
          if (!(Number(amount) > 0)) return setError('Enter a monthly limit greater than zero.');
          mutation.mutate();
        }}
      >
        <label className="field">
          <span className="field-label">Category</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Monthly limit</span>
          <div className="amount-input amount-input-sm">
            <span aria-hidden="true">₹</span>
            <input className="input" type="number" min="1" step="1" inputMode="decimal" placeholder="5000"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </label>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Set budget'}
        </button>
        {error && <p className="alert-error add-budget-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
