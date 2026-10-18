import { pool } from '../db';
import { ClientError } from '../errors';
import { findVisibleCategory } from './category';

export { ClientError }; // routes import it from here

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  category_id: number;
  amount: number;
  type: TransactionType;
  note: string | null;
  date: string; // 'YYYY-MM-DD' (see type parser in db.ts)
  created_at: string;
  category_name: string;
  icon: string | null;
}

export type TransactionInput = Pick<Transaction, 'amount' | 'type' | 'category_id' | 'note' | 'date'>;

export interface TransactionFilters {
  from?: string;       // inclusive 'YYYY-MM-DD'
  to?: string;         // inclusive 'YYYY-MM-DD'
  type?: TransactionType;
  categoryId?: number;
  q?: string;          // matches note or category name
}

export interface TransactionPage {
  items: Transaction[];
  total: number;                                   // matching rows (all pages)
  totals: { income: number; expense: number };     // sums over all matching rows
}

// Shared SELECT so every endpoint returns the same shape (with category name + icon)
const SELECT_WITH_CATEGORY = `
  SELECT t.id, t.user_id, t.category_id, t.amount, t.type, t.note, t.date, t.created_at,
         c.name AS category_name, c.icon
  FROM transactions t
  JOIN categories c ON t.category_id = c.id`;

// Escape LIKE wildcards so a search for "50%" matches literally
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Builds a parameterised WHERE clause — values never go into the SQL string
function buildWhere(userId: string, f: TransactionFilters) {
  const params: unknown[] = [userId];
  const conditions = ['t.user_id = $1'];
  const add = (sql: (p: string) => string, value: unknown) => {
    params.push(value);
    conditions.push(sql(`$${params.length}`));
  };
  if (f.from) add((p) => `t.date >= ${p}`, f.from);
  if (f.to) add((p) => `t.date <= ${p}`, f.to);
  if (f.type) add((p) => `t.type = ${p}`, f.type);
  if (f.categoryId) add((p) => `t.category_id = ${p}`, f.categoryId);
  if (f.q) add((p) => `(t.note ILIKE ${p} OR c.name ILIKE ${p})`, `%${escapeLike(f.q)}%`);
  return { where: conditions.join(' AND '), params };
}

// Ensures the category is one this user may use (built-in or their own) and matches the type
async function assertCategoryMatches(userId: string, categoryId: number, type: TransactionType): Promise<void> {
  const category = await findVisibleCategory(userId, categoryId);
  if (!category) throw new ClientError('Category not found');
  if (category.type !== type) throw new ClientError(`That category can't be used for ${type}`);
}

// One page of matching transactions (newest first) plus count and totals for the whole result
export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
  limit: number,
  offset: number
): Promise<TransactionPage> {
  const { where, params } = buildWhere(userId, filters);
  const [items, summary] = await Promise.all([
    pool.query<Transaction>(
      `${SELECT_WITH_CATEGORY}
       WHERE ${where}
       ORDER BY t.date DESC, t.created_at DESC, t.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    pool.query<{ total: string; income: number; expense: number }>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0)  AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expense
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE ${where}`,
      params
    ),
  ]);
  const s = summary.rows[0];
  return { items: items.rows, total: Number(s.total), totals: { income: s.income, expense: s.expense } };
}

// All matching rows for CSV export, capped so one request can't pull an unbounded result
export const EXPORT_ROW_LIMIT = 50_000;
export async function exportTransactions(userId: string, filters: TransactionFilters): Promise<Transaction[]> {
  const { where, params } = buildWhere(userId, filters);
  const { rows } = await pool.query<Transaction>(
    `${SELECT_WITH_CATEGORY}
     WHERE ${where}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ${EXPORT_ROW_LIMIT}`,
    params
  );
  return rows;
}

export async function getTransaction(id: string, userId: string): Promise<Transaction | null> {
  const { rows } = await pool.query<Transaction>(
    `${SELECT_WITH_CATEGORY}
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function createTransaction(userId: string, data: TransactionInput): Promise<Transaction> {
  await assertCategoryMatches(userId, data.category_id, data.type);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO transactions (user_id, amount, type, category_id, note, date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, data.amount, data.type, data.category_id, data.note, data.date]
  );
  return (await getTransaction(rows[0].id, userId))!;
}

// Replace all editable fields. Returns null if the transaction doesn't exist or belongs to another user.
export async function updateTransaction(
  id: string,
  userId: string,
  data: TransactionInput
): Promise<Transaction | null> {
  await assertCategoryMatches(userId, data.category_id, data.type);
  const { rowCount } = await pool.query(
    `UPDATE transactions
     SET amount = $1, type = $2, category_id = $3, note = $4, date = $5
     WHERE id = $6 AND user_id = $7`, // user_id check = ownership protection
    [data.amount, data.type, data.category_id, data.note, data.date, id, userId]
  );
  return rowCount ? getTransaction(id, userId) : null;
}

// Delete a transaction (only if it belongs to the user)
export async function deleteTransaction(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
