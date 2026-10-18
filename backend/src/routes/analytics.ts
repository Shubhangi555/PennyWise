import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Errors from these handlers propagate to the central error handler in server.ts (Express 5
// forwards rejected promises automatically).

// GET /analytics/summary — total income, expense, savings (0 instead of null when empty)
router.get('/summary', async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0) AS total_income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS total_savings
     FROM transactions
     WHERE user_id = $1`,
    [req.user!.userId]
  );
  res.json(rows[0]);
});

// GET /analytics/monthly — income vs expense per month (for bar chart)
// Returns: [{ month: 'Jan 2026', month_date: '2026-01-01', income: 45000, expense: 28000 }, ...]
router.get('/monthly', async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT
      TO_CHAR(DATE_TRUNC('month', date), 'Mon YYYY') AS month,
      DATE_TRUNC('month', date)::date AS month_date,
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0) AS income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
     FROM transactions
     WHERE user_id = $1
     GROUP BY DATE_TRUNC('month', date)
     ORDER BY DATE_TRUNC('month', date)`,
    [req.user!.userId]
  );
  res.json(rows);
});

// GET /analytics/by-category — spending by category (for pie chart)
// Returns: [{ name: 'Food', icon: '🍔', total: 8500 }, ...]
router.get('/by-category', async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT c.name, c.icon, SUM(t.amount) AS total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1 AND t.type = 'expense'
     GROUP BY c.id, c.name, c.icon
     ORDER BY total DESC`,
    [req.user!.userId]
  );
  res.json(rows);
});

export default router;
