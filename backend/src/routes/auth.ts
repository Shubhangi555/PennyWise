import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createUser, verifyCredentials, User } from '../models/user';
import { rateLimit } from '../middleware/rateLimit';

const router = Router(); // Router = mini express app for grouping routes

// Slow down password guessing: 20 attempts per IP per 15 minutes across login + register
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please try again in a few minutes.',
}));

function signToken(user: User): string {
  return jwt.sign(
    { userId: user.id, username: user.username }, // payload (what's inside the token)
    config.jwtSecret,                              // secret (signs the token)
    { expiresIn: config.jwtExpiresIn }             // expiry
  );
}

router.post('/register', async (req, res) => {
  const { password, displayName } = req.body ?? {};
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';

  // Basic validation before hitting the DB
  if (!username || typeof password !== 'string' || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3–50 characters: letters, numbers, . _ -' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password.length > 72) // bcrypt ignores anything past 72 bytes
    return res.status(400).json({ error: 'Password must be at most 72 characters' });
  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 100))
    return res.status(400).json({ error: 'Display name must be at most 100 characters' });

  try {
    const user = await createUser(username, password, displayName?.trim());
    res.status(201).json({ token: signToken(user), user }); // 201 = Created
  } catch (err) {
    if ((err as Error).message === 'Username already taken')
      return res.status(409).json({ error: 'Username already taken' }); // 409 = Conflict
    throw err; // unexpected → central error handler
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = await verifyCredentials(username.trim(), password);
  // Same message for unknown user and wrong password (don't reveal which usernames exist)
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  res.json({ token: signToken(user), user });
});

export default router;
