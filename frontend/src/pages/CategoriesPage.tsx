import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { useAppActions } from '../context/app-actions';
import { useCategories } from '../hooks/useFinanceData';
import { getErrorMessage } from '../lib/errors';
import { invalidateCategoryData } from '../lib/queries';
import type { Category, TxType } from '../types';

const EMOJI_CHOICES = [
  '🛒', '☕', '🍕', '🍺', '🎁', '📚', '🎓', '💡', '📱', '💳', '🏦', '⛽',
  '🚌', '🏥', '🐶', '👶', '🏋️', '🎮', '🎵', '💇', '🧹', '🛠️', '🌱', '💼',
  '🏆', '📦', '🎨', '🧾', '🪙', '✨',
];

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useAppActions();
  const { data: categories = [], isPending, isError, refetch } = useCategories();
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null; type: TxType }>({
    open: false, category: null, type: 'expense',
  });

  const deleteMutation = useMutation({
    mutationFn: (c: Category) => api.delete(`/categories/${c.id}`),
    onSuccess: (_res, c) => {
      invalidateCategoryData(queryClient);
      showToast(`Deleted "${c.name}"`);
    },
    // e.g. 409 "used by 3 transactions" — the server's message says what to do
    onError: (err) => showToast(getErrorMessage(err, "Couldn't delete the category")),
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p>Built-in categories plus your own. Yours can be renamed or removed.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ open: true, category: null, type: 'expense' })}>
          <PlusIcon /> New category
        </button>
      </div>

      {isError ? (
        <div className="alert-error load-error" role="alert">
          <span>Couldn't load categories.</span>
          <button type="button" className="btn btn-secondary" onClick={() => refetch()}>Try again</button>
        </div>
      ) : (
        <div className="split-grid even">
          {(['expense', 'income'] as const).map((type) => {
            const list = categories.filter((c) => c.type === type);
            return (
              <section key={type} className="card" aria-labelledby={`cat-${type}`}>
                <div className="card-head">
                  <div>
                    <h2 className="card-title" id={`cat-${type}`}>{type === 'expense' ? 'Expense categories' : 'Income categories'}</h2>
                    <p className="card-subtitle">{list.length} total · {list.filter((c) => c.is_custom).length} yours</p>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setDialog({ open: true, category: null, type })}>
                    <PlusIcon /> Add
                  </button>
                </div>
                <div className="card-body" style={{ paddingTop: 8 }}>
                  {isPending ? (
                    <div className="skeleton" style={{ height: 200 }} aria-hidden="true" />
                  ) : (
                    <ul className="category-list">
                      {list.map((c) => (
                        <li key={c.id} className="category-item">
                          <span className="category-emoji" aria-hidden="true">{c.icon ?? '•'}</span>
                          <span className="category-name">{c.name}</span>
                          {c.is_custom ? (
                            <span className="category-actions">
                              <button type="button" className="icon-btn" aria-label={`Edit ${c.name}`} title="Edit"
                                onClick={() => setDialog({ open: true, category: c, type: c.type })}>
                                <PencilIcon />
                              </button>
                              <button type="button" className="icon-btn danger" aria-label={`Delete ${c.name}`} title="Delete"
                                onClick={() => deleteMutation.mutate(c)} disabled={deleteMutation.isPending}>
                                <TrashIcon />
                              </button>
                            </span>
                          ) : (
                            <span className="badge">Built-in</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CategoryDialog
        open={dialog.open}
        category={dialog.category}
        type={dialog.type}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={(message) => {
          setDialog((d) => ({ ...d, open: false }));
          showToast(message);
        }}
      />
    </>
  );
}

// ─── Add / edit dialog ──────────────────────────────────────────────────────
function CategoryDialog({
  open, category, type, onClose, onSaved,
}: {
  open: boolean;
  category: Category | null;
  type: TxType;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="cat-dialog-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && <CategoryForm key={category?.id ?? `new-${type}`} category={category} initialType={type} onClose={onClose} onSaved={onSaved} />}
    </dialog>
  );
}

function CategoryForm({
  category, initialType, onClose, onSaved,
}: {
  category: Category | null;
  initialType: TxType;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = category !== null;
  const [type, setType] = useState<TxType>(category?.type ?? initialType);
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '🛒');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) await api.put(`/categories/${category.id}`, { name, icon });
      else await api.post('/categories', { name, icon, type });
    },
    onSuccess: () => {
      invalidateCategoryData(queryClient);
      onSaved(isEdit ? 'Category updated' : `Added "${name.trim()}"`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <form
      className="dialog-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) return setError('Give the category a name.');
        mutation.mutate();
      }}
    >
      <div className="dialog-head">
        <h2 id="cat-dialog-title">{isEdit ? 'Edit category' : 'New category'}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </div>

      {!isEdit && (
        <div className="segmented" role="radiogroup" aria-label="Type">
          {(['expense', 'income'] as const).map((t) => (
            <label key={t}>
              <input type="radio" name="cat-type" value={t} checked={type === t} onChange={() => setType(t)} />
              <span>{t === 'expense' ? 'Expense' : 'Income'}</span>
            </label>
          ))}
        </div>
      )}

      <div className="category-preview" aria-hidden="true">
        <span className={`tx-icon ${type}`}>{icon}</span>
        <span>{name.trim() || 'Category name'}</span>
      </div>

      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" value={name} maxLength={30} placeholder="e.g. Pets, Gym, Subscriptions"
          onChange={(e) => setName(e.target.value)} data-autofocus />
      </label>

      <fieldset className="field" style={{ border: 0 }}>
        <legend className="field-label" style={{ marginBottom: 6 }}>Icon</legend>
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((emoji) => (
            <label key={emoji} className="emoji-choice">
              <input type="radio" name="cat-icon" value={emoji} checked={icon === emoji} onChange={() => setIcon(emoji)} />
              <span aria-label={emoji}>{emoji}</span>
            </label>
          ))}
        </div>
        <label className="emoji-custom">
          <span className="field-label">Or type/paste any emoji</span>
          <input className="input" value={icon} maxLength={10} onChange={(e) => setIcon(e.target.value)} style={{ width: 90, textAlign: 'center', fontSize: 18 }} />
        </label>
      </fieldset>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <div className="dialog-foot">
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
        </button>
      </div>
    </form>
  );
}
