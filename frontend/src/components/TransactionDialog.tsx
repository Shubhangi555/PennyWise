import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { getErrorMessage } from '../lib/errors';
import { todayISO } from '../lib/format';
import { invalidateFinanceData } from '../lib/queries';
import type { NewTransactionDefaults } from '../context/app-actions';
import type { Category, Transaction, TransactionInput, TxType } from '../types';
import { CloseIcon, TrashIcon } from './Icons';

interface Props {
  open: boolean;
  transaction: Transaction | null; // null = add new
  defaults?: NewTransactionDefaults; // pre-selected type/category when adding
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onDelete: (tx: Transaction) => void;
}

export default function TransactionDialog({ open, transaction, defaults, categories, onClose, onSaved, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // Drive the native <dialog>: showModal() gives focus trapping, Esc and the backdrop for free
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus fires before showModal() and is lost, so focus the marked field here
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="tx-dialog-title"
      onClose={onClose} // Esc or dialog.close()
      onClick={(e) => { if (e.target === ref.current) onClose(); }} // backdrop click
    >
      {/* Remount on each open so the form starts from the right values */}
      {open && (
        <TransactionForm
          key={transaction?.id ?? 'new'}
          transaction={transaction}
          defaults={defaults}
          categories={categories}
          onClose={onClose}
          onSaved={onSaved}
          onDelete={onDelete}
        />
      )}
    </dialog>
  );
}

function TransactionForm({ transaction, defaults, categories, onClose, onSaved, onDelete }: Omit<Props, 'open'>) {
  const queryClient = useQueryClient();
  const isEdit = transaction !== null;

  const [type, setType] = useState<TxType>(transaction?.type ?? defaults?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [categoryId, setCategoryId] = useState<number | null>(
    transaction?.category_id ?? defaults?.category_id ?? null
  );
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [note, setNote] = useState(transaction?.note ?? '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: TransactionInput) =>
      isEdit ? api.put(`/transactions/${transaction.id}`, data) : api.post('/transactions', data),
    onSuccess: () => {
      invalidateFinanceData(queryClient);
      onSaved(isEdit ? 'Changes saved' : type === 'income' ? 'Income added' : 'Expense added');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const visibleCategories = categories.filter((c) => c.type === type);

  const handleTypeChange = (next: TxType) => {
    setType(next);
    // A category only belongs to one type — clear it if it no longer applies
    if (!categories.some((c) => c.id === categoryId && c.type === next)) setCategoryId(null);
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!(value > 0)) return setError('Enter an amount greater than zero.');
    if (categoryId === null) return setError('Pick a category.');
    if (!date) return setError('Pick a date.');
    mutation.mutate({ amount: value, type, category_id: categoryId, note: note.trim(), date });
  };

  return (
    <form className="dialog-form" onSubmit={handleSubmit} noValidate>
      <div className="dialog-head">
        <h2 id="tx-dialog-title">{isEdit ? 'Edit transaction' : 'New transaction'}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Type">
        {(['expense', 'income'] as const).map((t) => (
          <label key={t}>
            <input
              type="radio"
              name="tx-type"
              value={t}
              checked={type === t}
              onChange={() => handleTypeChange(t)}
            />
            <span>{t === 'expense' ? 'Expense' : 'Income'}</span>
          </label>
        ))}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="tx-amount">Amount</label>
        <div className="amount-input">
          <span aria-hidden="true">₹</span>
          <input
            id="tx-amount"
            className="input"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-autofocus
            required
          />
        </div>
      </div>

      <fieldset className="chip-grid">
        <legend className="field-label">Category</legend>
        {visibleCategories.length === 0 && (
          <p className="card-subtitle" role="status">Loading categories…</p>
        )}
        {visibleCategories.map((c) => (
          <label key={c.id} className="chip">
            <input
              type="radio"
              name="tx-category"
              value={c.id}
              checked={categoryId === c.id}
              onChange={() => setCategoryId(c.id)}
            />
            <span>
              <span className="chip-emoji" aria-hidden="true">{c.icon}</span>
              <span className="chip-label">{c.name}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="tx-date">Date</label>
          <input
            id="tx-date"
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tx-note">Note <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input
            id="tx-note"
            className="input"
            placeholder="e.g. Dinner with Sam"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <div className="dialog-foot">
        {isEdit && (
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => onDelete(transaction)}
            disabled={mutation.isPending}
          >
            <TrashIcon /> Delete
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : type === 'income' ? 'Add income' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
