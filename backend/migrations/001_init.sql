-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(10),
  type VARCHAR(10) CHECK (type IN ('income', 'expense'))
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id),
  amount NUMERIC(12,2) NOT NULL,
  type VARCHAR(10) CHECK (type IN ('income', 'expense')),
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default categories
INSERT INTO categories (name, icon, type) VALUES
  ('Salary',      '💰', 'income'),
  ('Freelance',   '💻', 'income'),
  ('Investment',  '📈', 'income'),
  ('Food',        '🍔', 'expense'),
  ('Rent',        '🏠', 'expense'),
  ('Transport',   '🚗', 'expense'),
  ('Shopping',    '🛍️', 'expense'),
  ('Health',      '💊', 'expense'),
  ('Travel',      '✈️', 'expense'),
  ('Entertainment','🎬', 'expense')
ON CONFLICT DO NOTHING;