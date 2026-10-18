import { Link } from 'react-router';
import BudgetOverview from '../components/BudgetOverview';
import Charts from '../components/Charts';
import { PlusIcon } from '../components/Icons';
import SummaryCards from '../components/SummaryCards';
import TransactionList from '../components/TransactionList';
import { useAppActions } from '../context/app-actions';
import { useAuth } from '../context/auth-context';
import { useRecentTransactions } from '../hooks/useFinanceData';

const RECENT_COUNT = 20;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { openAdd } = useAppActions();
  const recent = useRecentTransactions(RECENT_COUNT);

  const firstName = (user?.display_name || user?.username || '').split(' ')[0];
  const total = recent.data?.total ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p>Here's where your money stands.</p>
        </div>
        <button type="button" className="btn btn-primary page-add-btn" onClick={() => openAdd()}>
          <PlusIcon /> Add transaction
          <kbd className="shortcut-hint" style={{ marginLeft: 4, color: 'inherit', borderColor: 'rgba(255,255,255,0.4)' }}>N</kbd>
        </button>
      </div>

      <SummaryCards />
      <Charts />

      <div className="split-grid">
        <section className="card" aria-labelledby="tx-title">
          <div className="card-head" style={{ paddingBottom: 4 }}>
            <div>
              <h2 className="card-title" id="tx-title">Recent transactions</h2>
              {total > 0 && (
                <p className="card-subtitle">
                  {total > RECENT_COUNT ? `Latest ${RECENT_COUNT} of ${total}` : `${total} ${total === 1 ? 'entry' : 'entries'}`} · tap one to edit
                </p>
              )}
            </div>
            {total > 0 && <Link to="/transactions" className="btn btn-ghost">View all</Link>}
          </div>
          <TransactionList
            transactions={recent.data?.items ?? []}
            isPending={recent.isPending}
            isError={recent.isError}
            onRetry={() => recent.refetch()}
          />
        </section>

        <BudgetOverview />
      </div>
    </>
  );
}
