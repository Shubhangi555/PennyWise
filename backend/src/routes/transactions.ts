import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  ClientError,
  EXPORT_ROW_LIMIT,
  getTransaction,
  listTransactions,
  exportTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../models/transaction';
import { parseTransactionQuery, validateTransaction } from '../validation';
import { toCsv } from '../csv';

const router = Router();
router.use(authMiddleware); // protect ALL routes below — no token = blocked

// Malformed ids would otherwise make Postgres throw "invalid input syntax for type uuid" (a 500)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /transactions?from&to&type&category_id&q&limit&offset
// → { items, total, totals: { income, expense } } (newest first)
router.get('/', async (req: AuthRequest, res) => {
  const parsed = parseTransactionQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  res.json(await listTransactions(req.user!.userId, parsed.filters, parsed.limit, parsed.offset));
});

// GET /transactions/export — same filters, returns a CSV download
router.get('/export', async (req: AuthRequest, res) => {
  const parsed = parseTransactionQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const rows = await exportTransactions(req.user!.userId, parsed.filters);
  const csv = toCsv(
    ['Date', 'Type', 'Category', 'Amount', 'Note'],
    rows.map((t) => [t.date, t.type, t.category_name, t.amount.toFixed(2), t.note ?? ''])
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.setHeader('Cache-Control', 'no-store'); // personal financial data
  if (rows.length === EXPORT_ROW_LIMIT) res.setHeader('X-Export-Truncated', 'true');
  res.send(csv);
});

// POST /transactions — add a new transaction
router.post('/', async (req: AuthRequest, res) => {
  const result = validateTransaction(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });

  try {
    const tx = await createTransaction(req.user!.userId, result.value);
    res.status(201).json(tx);
  } catch (err) {
    if (err instanceof ClientError) return res.status(400).json({ error: err.message });
    throw err; // unexpected → central error handler (500, details logged not leaked)
  }
});

// PUT /transactions/:id — update a transaction. Fields left out keep their current value;
// send note: "" or null to clear the note.
router.put('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.userId;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Transaction not found' });

  const existing = await getTransaction(id, userId);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  const { amount, type, category_id, note, date } = existing;
  const result = validateTransaction({ amount, type, category_id, note, date, ...req.body });
  if (!result.ok) return res.status(400).json({ error: result.error });

  try {
    const tx = await updateTransaction(id, userId, result.value);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (err) {
    if (err instanceof ClientError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

// DELETE /transactions/:id — delete a transaction
router.delete('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Transaction not found' });

  const deleted = await deleteTransaction(id, req.user!.userId);
  if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ success: true });
});

export default router;
