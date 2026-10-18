import { pool } from '../db';
import bcrypt from 'bcryptjs';

// Public user shape — never includes password_hash
export interface User {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
}

const PUBLIC_COLUMNS = 'id, username, display_name, created_at';

// bcrypt hash of a random string; compared against when the username doesn't exist so the
// response time doesn't reveal which usernames are registered
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy', 10);

export async function createUser(
  username: string,
  password: string,
  displayName: string
): Promise<User> {
  // Hash password before saving — never store plain text passwords
  const passwordHash = await bcrypt.hash(password, 10); // 10 = salt rounds (how complex the hash is)

  try {
    const { rows } = await pool.query<User>(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING ${PUBLIC_COLUMNS}`,
      [username, passwordHash, displayName || username]
    );
    return rows[0];
  } catch (err) {
    // 23505 = unique_violation; relying on the constraint avoids a check-then-insert race
    if ((err as { code?: string }).code === '23505') throw new Error('Username already taken');
    throw err;
  }
}

// Returns the user if the credentials are valid, otherwise null
export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const { rows } = await pool.query<User & { password_hash: string }>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE username = $1`,
    [username]
  );

  const valid = await bcrypt.compare(password, rows[0]?.password_hash ?? DUMMY_HASH);
  if (!rows[0] || !valid) return null;

  const { password_hash: _omit, ...user } = rows[0];
  return user;
}
