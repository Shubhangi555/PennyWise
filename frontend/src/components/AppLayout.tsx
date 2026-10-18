import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { AppActionsContext, type AppActions, type NewTransactionDefaults, type ToastAction } from '../context/app-actions';
import { useCategories } from '../hooks/useFinanceData';
import { getErrorMessage } from '../lib/errors';
import { formatCurrency } from '../lib/format';
import { invalidateFinanceData } from '../lib/queries';
import type { Transaction } from '../types';
import { NAV_ITEMS } from '../nav';
import AppHeader from './AppHeader';
import { PlusIcon } from './Icons';
import Toast, { type ToastState } from './Toast';
import TransactionDialog from './TransactionDialog';

// Typing in a field shouldn't trigger single-key shortcuts
function isTypingTarget(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

// Shell for every signed-in page: header, page outlet, mobile tab bar, add button,
// the add/edit dialog and toasts. Pages reach these through useAppActions().
export default function AppLayout() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [dialog, setDialog] = useState<{
    open: boolean;
    transaction: Transaction | null;
    defaults?: NewTransactionDefaults;
  }>({ open: false, transaction: null });
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    setToast({ id: ++toastId.current, message, action });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const openAdd = useCallback(
    (defaults?: NewTransactionDefaults) => setDialog({ open: true, transaction: null, defaults }),
    []
  );
  const openEdit = useCallback((tx: Transaction) => setDialog({ open: true, transaction: tx }), []);
  const closeDialog = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  // Press N anywhere (outside a text field) to add a transaction
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (dialog.open || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      openAdd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog.open, openAdd]);

  // Undo = re-create the deleted transaction with the same details
  const restoreMutation = useMutation({
    mutationFn: (tx: Transaction) =>
      api.post('/transactions', {
        amount: tx.amount, type: tx.type, category_id: tx.category_id, note: tx.note ?? '', date: tx.date,
      }),
    onSuccess: () => {
      invalidateFinanceData(queryClient);
      showToast('Transaction restored');
    },
    onError: (err) => showToast(getErrorMessage(err, "Couldn't restore the transaction")),
  });

  // Delete immediately (no confirm popup) and offer Undo — faster, and mistakes are recoverable
  const deleteMutation = useMutation({
    mutationFn: (tx: Transaction) => api.delete(`/transactions/${tx.id}`),
    onSuccess: (_res, tx) => {
      invalidateFinanceData(queryClient);
      showToast(`Deleted ${tx.category_name} · ${formatCurrency(tx.amount)}`, {
        label: 'Undo',
        onClick: () => restoreMutation.mutate(tx),
      });
    },
    onError: (err) => showToast(getErrorMessage(err, "Couldn't delete the transaction")),
  });
  const { mutate: deleteMutate } = deleteMutation;

  const deleteTransaction = useCallback(
    (tx: Transaction) => {
      closeDialog();
      deleteMutate(tx);
    },
    [closeDialog, deleteMutate]
  );

  const deletingId = deleteMutation.isPending ? deleteMutation.variables?.id : undefined;
  const actions = useMemo<AppActions>(
    () => ({ openAdd, openEdit, deleteTransaction, deletingId, showToast }),
    [openAdd, openEdit, deleteTransaction, deletingId, showToast]
  );

  return (
    <AppActionsContext.Provider value={actions}>
      <AppHeader />

      <main className="app-main">
        <Outlet />
      </main>

      {/* Mobile: bottom tab bar + floating add button (desktop uses the header) */}
      <nav className="tab-bar" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="tab-bar-link">
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button type="button" className="fab" onClick={() => openAdd()} aria-label="Add transaction">
        <PlusIcon />
      </button>

      <TransactionDialog
        open={dialog.open}
        transaction={dialog.transaction}
        defaults={dialog.defaults}
        categories={categories}
        onClose={closeDialog}
        onSaved={(message) => {
          closeDialog();
          showToast(message);
        }}
        onDelete={deleteTransaction}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </AppActionsContext.Provider>
  );
}
