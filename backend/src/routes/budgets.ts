import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ClientError } from '../errors';
import { getBudgetMonth, removeBudget, setBudget } from '../models/budget';
import { parseMonth, validateBudgetAmount } from '../validation';

const router = Router();
router.use(authMiddleware);

const parseCategoryId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /budgets?month=YYYY-MM (default: current month)
// → { month, items: [{ category_id, name, icon, budget, spent }], total_spent }
router.get('/', async (req: AuthRequest, res) => {
  let monthStart: string | null;
  if (req.query.month === undefined) {
    const now = new Date();
    monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  } else {
    monthStart = parseMonth(req.query.month);
    if (!monthStart) return res.status(400).json({ error: 'month must be in YYYY-MM format' });
  }
  res.json(await getBudgetMonth(req.user!.userId, monthStart));
});

// PUT /budgets/:categoryId — { amount } create or update the monthly limit
router.put('/:categoryId', async (req: AuthRequest, res) => {
  const categoryId = parseCategoryId(req.params.categoryId);
  if (!categoryId) return res.status(404).json({ error: 'Category not found' });
  const result = validateBudgetAmount(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  try {
    await setBudget(req.user!.userId, categoryId, result.amount);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof ClientError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

// DELETE /budgets/:categoryId
router.delete('/:categoryId', async (req: AuthRequest, res) => {
  const categoryId = parseCategoryId(req.params.categoryId);
  if (!categoryId) return res.status(404).json({ error: 'Budget not found' });
  const removed = await removeBudget(req.user!.userId, categoryId);
  if (!removed) return res.status(404).json({ error: 'Budget not found' });
  res.json({ success: true });
});

export default router;
