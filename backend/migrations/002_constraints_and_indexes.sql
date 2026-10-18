-- 001 used to re-run on every server start, and its category seed duplicated each time
-- (ON CONFLICT DO NOTHING had no unique constraint to conflict on). Clean that up.

-- 1. Point transactions at the earliest copy of each duplicated category
UPDATE transactions t
SET category_id = keep.id
FROM categories c
JOIN (SELECT MIN(id) AS id, name, type FROM categories GROUP BY name, type) keep
  ON keep.name = c.name AND keep.type IS NOT DISTINCT FROM c.type
WHERE t.category_id = c.id
  AND c.id <> keep.id;

-- 2. Remove the duplicates
DELETE FROM categories c
USING categories k
WHERE c.name = k.name
  AND c.type IS NOT DISTINCT FROM k.type
  AND c.id > k.id;

-- 3. Prevent it happening again
ALTER TABLE categories ADD CONSTRAINT categories_name_type_key UNIQUE (name, type);

-- Tighten columns the app always fills in
ALTER TABLE categories   ALTER COLUMN type        SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id     SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN type        SET NOT NULL;

-- Amounts must be positive; the type column carries the sign.
-- NOT VALID = enforce for new/updated rows without failing on any old bad data.
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;

-- Every transaction/analytics query filters by user_id and most sort/group by date
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
