import { useEffect, useRef, type ReactNode } from 'react';
import { useAppActions } from '../context/app-actions';
import type { Transaction } from '../types';
import { formatCurrency, formatDayHeading } from '../lib/format';
import { PlusIcon, TrashIcon } from './Icons';

interface Props {
  transactions: Transaction[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyState?: ReactNode;   // override, e.g. "no matches for these filters"
  footer?: ReactNode;       // rendered at the end of the scroll area
  onReachEnd?: () => void;  // called when the end of the list scrolls into view (load more)
  className?: string;       // extra class for the scroll area (sets its height)
}

// Group consecutive transactions by date (API returns newest first)
function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[]; net: number }[] = [];
  for (const tx of transactions) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, items: [], net: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    group.net += tx.type === 'income' ? tx.amount : -tx.amount;
  }
  return groups;
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" style={{ padding: '12px 20px', display: 'grid', gap: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div className="skeleton" style={{ width: '30%', height: 14 }} />
            <div className="skeleton" style={{ width: '45%', height: 12 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 16 }} />
        </div>
      ))}
    </div>
  );
}

export default function TransactionList({
  transactions, isPending, isError, onRetry, emptyState, footer, onReachEnd, className = '',
}: Props) {
  const { openAdd, openEdit, deleteTransaction, deletingId } = useAppActions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load more when the sentinel at the bottom of the scroll area becomes visible
  useEffect(() => {
    if (!onReachEnd || !endRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onReachEnd(),
      { root: scrollRef.current, rootMargin: '200px' }
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [onReachEnd, transactions.length]);

  if (isPending) return <ListSkeleton />;

  if (isError) {
    return (
      <div className="card-body">
        <div className="alert-error load-error" role="alert">
          <span>Couldn't load your transactions.</span>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      emptyState ?? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">🧾</span>
          <h3>No transactions yet</h3>
          <p>Add your salary or today's coffee — your totals and charts fill in as you go.</p>
          <button type="button" className="btn btn-primary" onClick={() => openAdd()}>
            <PlusIcon /> Add your first transaction
          </button>
        </div>
      )
    );
  }

  // Fixed-height panel that scrolls on its own, so a long history doesn't stretch the page
  return (
    <div ref={scrollRef} className={`scroll-area tx-scroll ${className}`} tabIndex={0} aria-label="Transactions list">
      {groupByDate(transactions).map((group) => (
        <section key={group.date} className="tx-group" aria-label={formatDayHeading(group.date)}>
          <h3 className="tx-day">
            <span>{formatDayHeading(group.date)}</span>
            <span>{group.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(group.net))}</span>
          </h3>
          <ul className="tx-list">
            {group.items.map((tx) => (
              <li key={tx.id} className="tx-row">
                <button
                  type="button"
                  className="tx-main"
                  onClick={() => openEdit(tx)}
                  aria-label={`${tx.category_name}, ${tx.type === 'income' ? 'income' : 'expense'} of ${formatCurrency(tx.amount)}${tx.note ? `, ${tx.note}` : ''}. Edit`}
                >
                  <span className={`tx-icon ${tx.type}`} aria-hidden="true">{tx.icon}</span>
                  <span className="tx-text">
                    <span className="tx-title">{tx.category_name}</span>
                    {tx.note && <span className="tx-note" style={{ display: 'block' }}>{tx.note}</span>}
                  </span>
                  <span className={`tx-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '−'}{formatCurrency(tx.amount)}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => deleteTransaction(tx)}
                  disabled={deletingId === tx.id}
                  aria-label={`Delete ${tx.category_name} ${formatCurrency(tx.amount)}`}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {footer}
      <div ref={endRef} aria-hidden="true" style={{ height: 1 }} />
    </div>
  );
}
