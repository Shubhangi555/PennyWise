import { pool } from '../db';
import { ClientError } from '../errors';
import type { TransactionType } from './transaction';

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  type: TransactionType;
  is_custom: boolean; // false = built-in (shared by everyone, read-only)
}

const VISIBLE_TO = '(c.user_id IS NULL OR c.user_id = $1)'; // built-ins + the user's own

export async function listCategories(userId: string): Promise<Category[]> {
  const { rows } = await pool.query<Category>(
    `SELECT c.id, c.name, c.icon, c.type, (c.user_id IS NOT NULL) AS is_custom
     FROM categories c
     WHERE ${VISIBLE_TO}
     ORDER BY c.type, lower(c.name)`,
    [userId]
  );
  return rows;
}

// Returns the category if this user may use it (built-in or their own), else null
export async function findVisibleCategory(
  userId: string,
  categoryId: number
): Promise<(Category & { user_id: string | null }) | null> {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.icon, c.type, c.user_id, (c.user_id IS NOT NULL) AS is_custom
     FROM categories c
     WHERE c.id = $2 AND ${VISIBLE_TO}`,
    [userId, categoryId]
  );
  return rows[0] ?? null;
}

// Case-insensitive clash with a built-in or one of the user's own categories of the same type
async function assertNameFree(userId: string, name: string, type: TransactionType, exceptId?: number) {
  const { rows } = await pool.query(
    `SELECT 1 FROM categories c
     WHERE ${VISIBLE_TO} AND lower(c.name) = lower($2) AND c.type = $3 AND c.id <> COALESCE($4, -1)`,
    [userId, name, type, exceptId ?? null]
  );
  if (rows.length > 0) throw new ClientError(`You already have an ${type} category called "${name}"`);
}

// Postgres unique_violation from the partial unique indexes (race between check and insert)
function isUniqueViolation(err: unknown) {
  return (err as { code?: string }).code === '23505';
}

export async function createCategory(
  userId: string,
  data: { name: string; icon: string | null; type: TransactionType }
): Promise<Category> {
  await assertNameFree(userId, data.name, data.type);
  try {
    const { rows } = await pool.query<Category>(
      `INSERT INTO categories (name, icon, type, user_id) VALUES ($1, $2, $3, $4)
       RETURNING id, name, icon, type, true AS is_custom`,
      [data.name, data.icon, data.type, userId]
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new ClientError(`You already have an ${data.type} category called "${data.name}"`);
    throw err;
  }
}

// Only the owner can edit; built-ins are read-only. Type can't change (transactions depend on it).
export async function updateCategory(
  userId: string,
  categoryId: number,
  data: { name: string; icon: string | null }
): Promise<Category | null> {
  const existing = await findVisibleCategory(userId, categoryId);
  if (!existing || existing.user_id !== userId) return null;
  await assertNameFree(userId, data.name, existing.type, categoryId);
  try {
    const { rows } = await pool.query<Category>(
      `UPDATE categories SET name = $1, icon = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, icon, type, true AS is_custom`,
      [data.name, data.icon, categoryId, userId]
    );
    return rows[0] ?? null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ClientError(`You already have an ${existing.type} category called "${data.name}"`);
    throw err;
  }
}

// Refuses while transactions still use it, so no history is silently lost.
// Its budget (if any) is removed with it (ON DELETE CASCADE).
export async function deleteCategory(userId: string, categoryId: number): Promise<'deleted' | 'not_found'> {
  const existing = await findVisibleCategory(userId, categoryId);
  if (!existing || existing.user_id !== userId) return 'not_found';

  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE category_id = $1 AND user_id = $2',
    [categoryId, userId]
  );
  const used = Number(rows[0].count);
  if (used > 0) {
    throw new ClientError(
      `"${existing.name}" is used by ${used} transaction${used === 1 ? '' : 's'}. Move them to another category first.`
    );
  }
  await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  return 'deleted';
}
