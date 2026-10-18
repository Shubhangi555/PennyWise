export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  category_id: number;
  category_name: string;
  icon: string | null;
  note: string | null;
  date: string; // 'YYYY-MM-DD'
  created_at: string;
}

export interface TransactionInput {
  amount: number;
  type: TxType;
  category_id: number;
  note: string;
  date: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  type: TxType;
  is_custom: boolean; // false = built-in (read-only)
}

// GET /transactions response
export interface TransactionPage {
  items: Transaction[];
  total: number;
  totals: { income: number; expense: number };
}

// Filters shared by the list and CSV export (all optional; strings as sent in the query)
export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: TxType;
  category_id?: number;
  q?: string;
}

export interface BudgetProgress {
  category_id: number;
  name: string;
  icon: string | null;
  budget: number;
  spent: number;
}

export interface BudgetMonth {
  month: string; // 'YYYY-MM-01'
  items: BudgetProgress[];
  total_spent: number;
}

export interface Summary {
  total_income: number;
  total_expense: number;
  total_savings: number;
}

export interface MonthlyPoint {
  month: string;      // 'Oct 2026'
  month_date: string; // '2026-10-01'
  income: number;
  expense: number;
}

export interface CategoryTotal {
  name: string;
  icon: string | null;
  total: number;
}
