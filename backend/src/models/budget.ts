import { pool } from '../db';
import { ClientError } from '../errors';
import { findVisibleCategory } from './category';

export interface BudgetProgress {
  category_id: number;
  name: string;
  icon: string | null;
  budget: number; // monthly limit
  spent: number;  // expenses in that category during the month
}

export interface BudgetMonth {
  month: string;             // 'YYYY-MM-01'
  items: BudgetProgress[];
  total_spent: number;       // all expenses that month, budgeted or not
}

// monthStart is 'YYYY-MM-01'; the month runs up to (not including) the next month's 1st
export async function getBudgetMonth(userId: string, monthStart: string): Promise<BudgetMonth> {
  const [items, total] = await Promise.all([
    pool.query<BudgetProgress>(
      `SELECT c.id AS category_id, c.name, c.icon, b.amount AS budget,
              COALESCE(SUM(t.amount), 0) AS spent
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN transactions t
         ON t.category_id = b.category_id
        AND t.user_id = b.user_id
        AND t.type = 'expense'
        AND t.date >= $2::date
        AND t.date < ($2::date + INTERVAL '1 month')
       WHERE b.user_id = $1
       GROUP BY c.id, c.name, c.icon, b.amount
       ORDER BY lower(c.name)`,
      [userId, monthStart]
    ),
    pool.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND date >= $2::date AND date < ($2::date + INTERVAL '1 month')`,
      [userId, monthStart]
    ),
  ]);
  return { month: monthStart, items: items.rows, total_spent: total.rows[0].total };
}

// Create or change the monthly limit for one expense category
export async function setBudget(userId: string, categoryId: number, amount: number): Promise<void> {
  const category = await findVisibleCategory(userId, categoryId);
  if (!category) throw new ClientError('Category not found');
  if (category.type !== 'expense') throw new ClientError('Budgets can only be set on expense categories');

  await pool.query(
    `INSERT INTO budgets (user_id, category_id, amount) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category_id) DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
    [userId, categoryId, amount]
  );
}

export async function removeBudget(userId: string, categoryId: number): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM budgets WHERE user_id = $1 AND category_id = $2', [userId, categoryId]);
  return (rowCount ?? 0) > 0;
}
