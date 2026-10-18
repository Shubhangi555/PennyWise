import type { TransactionFilters, TransactionInput, TransactionType } from './models/transaction';

const TYPES: readonly TransactionType[] = ['income', 'expense'];
const MAX_AMOUNT = 9_999_999_999.99; // NUMERIC(12,2) upper bound
const MAX_NOTE_LENGTH = 500;

export type ValidationResult =
  | { ok: true; value: TransactionInput }
  | { ok: false; error: string };

// True only for real calendar dates in strict YYYY-MM-DD form (rejects 2026-02-30)
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Parses a positive money amount (number or numeric string) rounded to paise
function parseAmount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

// ─── Query string filters for GET /transactions and /transactions/export ────
const MAX_PAGE_SIZE = 200;
const MAX_SEARCH_LENGTH = 100;

export type FilterResult =
  | { ok: true; filters: TransactionFilters; limit: number; offset: number }
  | { ok: false; error: string };

export function parseTransactionQuery(query: Record<string, unknown>): FilterResult {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  const filters: TransactionFilters = {};

  const from = str(query.from);
  const to = str(query.to);
  if (from !== undefined) {
    if (!isValidDate(from)) return { ok: false, error: 'from must be a date in YYYY-MM-DD format' };
    filters.from = from;
  }
  if (to !== undefined) {
    if (!isValidDate(to)) return { ok: false, error: 'to must be a date in YYYY-MM-DD format' };
    filters.to = to;
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { ok: false, error: 'from must be on or before to' };
  }

  const type = str(query.type);
  if (type !== undefined) {
    if (!TYPES.includes(type as TransactionType)) return { ok: false, error: "type must be 'income' or 'expense'" };
    filters.type = type as TransactionType;
  }

  const category = str(query.category_id);
  if (category !== undefined) {
    const id = Number(category);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'category_id must be a valid category' };
    filters.categoryId = id;
  }

  const q = str(query.q);
  if (q !== undefined) filters.q = q.slice(0, MAX_SEARCH_LENGTH);

  const limit = query.limit === undefined ? 50 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return { ok: false, error: `limit must be between 1 and ${MAX_PAGE_SIZE}` };
  }
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, error: 'offset must be 0 or more' };

  return { ok: true, filters, limit, offset };
}

// ─── Categories ─────────────────────────────────────────────────────────────
const MAX_CATEGORY_NAME = 30;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export type CategoryResult =
  | { ok: true; value: { name: string; icon: string | null; type: TransactionType } }
  | { ok: false; error: string };

// requireType: true when creating; on update the type can't change, so it's ignored
export function validateCategory(body: unknown, requireType: boolean): CategoryResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object' };
  const { name, icon, type } = body as Record<string, unknown>;

  const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!trimmed) return { ok: false, error: 'Give the category a name' };
  if (trimmed.length > MAX_CATEGORY_NAME) {
    return { ok: false, error: `Name must be at most ${MAX_CATEGORY_NAME} characters` };
  }

  let cleanIcon: string | null = null;
  if (icon !== undefined && icon !== null && icon !== '') {
    if (typeof icon !== 'string') return { ok: false, error: 'icon must be text' };
    const graphemes = [...segmenter.segment(icon.trim())];
    // One visible symbol (an emoji may be several code points); column is VARCHAR(10)
    if (graphemes.length !== 1 || [...icon.trim()].length > 10) {
      return { ok: false, error: 'Icon must be a single emoji or character' };
    }
    cleanIcon = icon.trim();
  }

  if (requireType && !TYPES.includes(type as TransactionType)) {
    return { ok: false, error: "type must be 'income' or 'expense'" };
  }

  return { ok: true, value: { name: trimmed, icon: cleanIcon, type: type as TransactionType } };
}

// ─── Budgets ────────────────────────────────────────────────────────────────
export function validateBudgetAmount(body: unknown): { ok: true; amount: number } | { ok: false; error: string } {
  const amount = parseAmount((body as Record<string, unknown> | null)?.amount);
  if (amount === null) return { ok: false, error: 'Budget must be a positive amount' };
  return { ok: true, amount };
}

// 'YYYY-MM' → first day of that month as 'YYYY-MM-01'
export function parseMonth(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return `${value}-01`;
}

// Validates and normalises a full transaction payload. Category existence / type match
// is checked separately against the DB (see assertCategoryMatches in the model).
export function validateTransaction(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const { amount, type, category_id, note, date } = body as Record<string, unknown>;

  const amountNum = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof amountNum === 'number' && amountNum > MAX_AMOUNT) {
    return { ok: false, error: 'amount is too large' };
  }
  const parsedAmount = parseAmount(amount);
  if (parsedAmount === null) {
    return { ok: false, error: 'amount must be a positive number' };
  }

  if (!TYPES.includes(type as TransactionType)) {
    return { ok: false, error: "type must be 'income' or 'expense'" };
  }

  const categoryId = Number(category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: 'category_id must be a valid category' };
  }

  if (!isValidDate(date)) {
    return { ok: false, error: 'date must be a valid date in YYYY-MM-DD format' };
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    return { ok: false, error: 'note must be text' };
  }
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  if (trimmedNote.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `note must be at most ${MAX_NOTE_LENGTH} characters` };
  }

  return {
    ok: true,
    value: {
      amount: parsedAmount,
      type: type as TransactionType,
      category_id: categoryId,
      note: trimmedNote || null, // empty note is stored as NULL, so it can be cleared
      date,
    },
  };
}
