-- ─── Custom categories ──────────────────────────────────────────────────────
-- user_id NULL = built-in category everyone sees; otherwise owned by that user.
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Names are unique per owner and type (case-insensitive). The old constraint
-- covered built-ins only and would wrongly block two users picking the same name.
ALTER TABLE categories DROP CONSTRAINT categories_name_type_key;
CREATE UNIQUE INDEX categories_builtin_name_type ON categories (lower(name), type) WHERE user_id IS NULL;
CREATE UNIQUE INDEX categories_user_name_type ON categories (user_id, lower(name), type) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

-- ─── Monthly budgets (one limit per expense category, repeats every month) ──
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

-- Budget progress sums a user's spending per category within a month
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date ON transactions (user_id, category_id, date);
