import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import api from '../api/axios';
import { DownloadIcon, PlusIcon, SearchIcon } from '../components/Icons';
import TransactionList from '../components/TransactionList';
import { useAppActions } from '../context/app-actions';
import { cleanFilters, useCategories, useTransactionSearch } from '../hooks/useFinanceData';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency, todayISO } from '../lib/format';
import type { TransactionFilters, TxType } from '../types';

// ─── Date range presets ─────────────────────────────────────────────────────
const RANGES = {
  all: 'All time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'this-year': 'This year',
  custom: 'Custom range',
} as const;
type RangeKey = keyof typeof RANGES;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeDates(range: RangeKey, from?: string, to?: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (range) {
    case 'this-month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'last-month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'last-3-months': return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'this-year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom': return { from: from || undefined, to: to || undefined };
    default: return {};
  }
}

const SEARCH_DEBOUNCE_MS = 300;

export default function TransactionsPage() {
  const { openAdd, showToast } = useAppActions();
  const { data: categories = [] } = useCategories();
  const [params, setParams] = useSearchParams();

  // URL is the source of truth for filters (back button, refresh and bookmarks all work)
  const range = (params.get('range') as RangeKey) in RANGES ? (params.get('range') as RangeKey) : 'all';
  const type = (params.get('type') as TxType | null) ?? undefined;
  const categoryId = params.get('category') ? Number(params.get('category')) : undefined;
  const q = params.get('q') ?? '';
  const customFrom = params.get('from') ?? '';
  const customTo = params.get('to') ?? '';

  // Functional update: builds on the latest URL, so two quick changes (e.g. category then
  // date range) don't overwrite each other with a stale copy
  const updateParams = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  };

  // Search box updates the URL after a short pause, not on every keystroke
  const [searchText, setSearchText] = useState(q);
  useEffect(() => {
    if (searchText.trim() === q) return;
    const timer = setTimeout(() => updateParams({ q: searchText.trim() || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateParams is rebuilt each render; q/searchText are the real inputs
  }, [searchText, q]);

  const filters: TransactionFilters = useMemo(
    () => ({ ...rangeDates(range, customFrom, customTo), type, category_id: categoryId, q: q || undefined }),
    [range, customFrom, customTo, type, categoryId, q]
  );
  const search = useTransactionSearch(filters);
  const items = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const firstPage = search.data?.pages[0];
  const hasFilters = range !== 'all' || !!type || !!categoryId || !!q;

  // Categories offered in the dropdown follow the type filter
  const categoryOptions = categories.filter((c) => !type || c.type === type);

  const clearFilters = () => {
    setSearchText('');
    setParams(new URLSearchParams(), { replace: true });
  };

  // CSV download needs the auth header, so fetch it as a blob instead of a plain link
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/transactions/export', { params: cleanFilters(filters), responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pennywise-transactions-${range}-${todayISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(res.headers['x-export-truncated'] ? 'Exported the first 50,000 rows' : 'CSV downloaded');
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't export your transactions"));
    } finally {
      setExporting(false);
    }
  };

  const income = firstPage?.totals.income ?? 0;
  const expense = firstPage?.totals.expense ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Search, filter and export your history.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={exporting || !firstPage?.total}>
            <DownloadIcon /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" className="btn btn-primary page-add-btn" onClick={() => openAdd()}>
            <PlusIcon /> Add
          </button>
        </div>
      </div>

      <section className="card filter-card" aria-label="Filters">
        <div className="filter-row">
          <label className="search-field">
            <SearchIcon />
            <span className="sr-only">Search notes and categories</span>
            <input
              type="search"
              className="input"
              placeholder="Search notes or categories"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxLength={100}
            />
          </label>

          <div className="segmented filter-type" role="radiogroup" aria-label="Type">
            {([['', 'All'], ['expense', 'Expenses'], ['income', 'Income']] as const).map(([value, label]) => (
              <label key={label}>
                <input
                  type="radio"
                  name="filter-type"
                  value={value}
                  checked={(type ?? '') === value}
                  onChange={() => {
                    // Drop a category that doesn't belong to the newly chosen type (leave it otherwise)
                    const keepCategory = !value || categories.find((c) => c.id === categoryId)?.type === value;
                    updateParams(keepCategory ? { type: value || undefined } : { type: value, category: undefined });
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <select
            className="input"
            aria-label="Category"
            value={categoryId ?? ''}
            onChange={(e) => updateParams({ category: e.target.value || undefined })}
          >
            <option value="">All categories</option>
            {(['expense', 'income'] as const).map((t) => {
              const group = categoryOptions.filter((c) => c.type === t);
              if (group.length === 0) return null;
              return (
                <optgroup key={t} label={t === 'expense' ? 'Expenses' : 'Income'}>
                  {group.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <select
            className="input"
            aria-label="Date range"
            value={range}
            onChange={(e) => {
              const next = e.target.value as RangeKey;
              updateParams({
                range: next === 'all' ? undefined : next,
                // Seed a custom range with the current month so the inputs aren't empty
                from: next === 'custom' ? customFrom || rangeDates('this-month').from : undefined,
                to: next === 'custom' ? customTo || rangeDates('this-month').to : undefined,
              });
            }}
          >
            {Object.entries(RANGES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {range === 'custom' && (
          <div className="filter-row filter-custom">
            <label className="field">
              <span className="field-label">From</span>
              <input type="date" className="input" value={customFrom} max={customTo || undefined}
                onChange={(e) => updateParams({ from: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span className="field-label">To</span>
              <input type="date" className="input" value={customTo} min={customFrom || undefined}
                onChange={(e) => updateParams({ to: e.target.value || undefined })} />
            </label>
          </div>
        )}

        <div className="filter-summary" aria-live="polite">
          {firstPage ? (
            <>
              <span><b>{firstPage.total}</b> {firstPage.total === 1 ? 'transaction' : 'transactions'}</span>
              <span>In <b className="amount-income">{formatCurrency(income)}</b></span>
              <span>Out <b>{formatCurrency(expense)}</b></span>
              <span>Net <b>{formatCurrency(income - expense)}</b></span>
            </>
          ) : (
            <span>Loading…</span>
          )}
          {hasFilters && (
            <button type="button" className="btn btn-ghost filter-clear" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      </section>

      <section className="card" aria-label="Results" style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}>
        <TransactionList
          className="tx-scroll-page"
          transactions={items}
          isPending={search.isPending}
          isError={search.isError}
          onRetry={() => search.refetch()}
          onReachEnd={search.hasNextPage && !search.isFetchingNextPage ? () => search.fetchNextPage() : undefined}
          footer={
            search.hasNextPage || search.isFetchingNextPage ? (
              <div className="list-footer">
                <button type="button" className="btn btn-secondary" onClick={() => search.fetchNextPage()} disabled={search.isFetchingNextPage}>
                  {search.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : items.length > 10 ? (
              <p className="list-footer">That's everything.</p>
            ) : null
          }
          emptyState={
            hasFilters ? (
              <div className="empty-state">
                <span className="empty-state-icon" aria-hidden="true">🔍</span>
                <h3>No matches</h3>
                <p>Nothing fits these filters. Try a wider date range or a different search.</p>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : undefined
          }
        />
      </section>
    </>
  );
}
