import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ClientError } from '../errors';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../models/category';
import { validateCategory } from '../validation';

const router = Router();
router.use(authMiddleware);

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /categories — built-ins + the user's own, each with is_custom
router.get('/', async (req: AuthRequest, res) => {
  res.json(await listCategories(req.user!.userId));
});

// POST /categories — { name, icon?, type }
router.post('/', async (req: AuthRequest, res) => {
  const result = validateCategory(req.body, true);
  if (!result.ok) return res.status(400).json({ error: result.error });
  try {
    res.status(201).json(await createCategory(req.user!.userId, result.value));
  } catch (err) {
    if (err instanceof ClientError) return res.status(409).json({ error: err.message });
    throw err;
  }
});

// PUT /categories/:id — { name, icon? } (own categories only; type is fixed)
router.put('/:id', async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Category not found' });
  const result = validateCategory(req.body, false);
  if (!result.ok) return res.status(400).json({ error: result.error });
  try {
    const category = await updateCategory(req.user!.userId, id, result.value);
    if (!category) return res.status(404).json({ error: "Category not found (built-in categories can't be edited)" });
    res.json(category);
  } catch (err) {
    if (err instanceof ClientError) return res.status(409).json({ error: err.message });
    throw err;
  }
});

// DELETE /categories/:id — own categories with no transactions
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Category not found' });
  try {
    const result = await deleteCategory(req.user!.userId, id);
    if (result === 'not_found') {
      return res.status(404).json({ error: "Category not found (built-in categories can't be deleted)" });
    }
    res.json({ success: true });
  } catch (err) {
    if (err instanceof ClientError) return res.status(409).json({ error: err.message });
    throw err;
  }
});

export default router;
