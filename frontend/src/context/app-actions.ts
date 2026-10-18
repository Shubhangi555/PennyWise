import { createContext, useContext } from 'react';
import type { Transaction, TxType } from '../types';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface NewTransactionDefaults {
  type?: TxType;
  category_id?: number;
}

// App-wide actions any page can trigger (dialog + toast live in AppLayout)
export interface AppActions {
  openAdd: (defaults?: NewTransactionDefaults) => void;
  openEdit: (tx: Transaction) => void;
  deleteTransaction: (tx: Transaction) => void;
  deletingId?: string;
  showToast: (message: string, action?: ToastAction) => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be inside AppLayout');
  return ctx;
}
