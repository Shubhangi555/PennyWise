import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Extending Express Request to carry user info after token verification
export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Token comes in header like: "Bearer eyJ..."
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  // No token = not logged in = block immediately
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'No token provided' });

  try {
    // jwt.verify checks signature + expiry; algorithms pinned so a token can't pick its own
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as {
      userId: string;
      username: string;
    };

    req.user = { userId: decoded.userId, username: decoded.username };
    next();
  } catch {
    // token is fake, expired, or tampered
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
