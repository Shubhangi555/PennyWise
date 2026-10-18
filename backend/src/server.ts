import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config'; // first: loads .env and validates required vars
import { pool } from './db';
import { runMigrations } from './migrator';
import authRouter from './routes/auth';
import transactionRouter from './routes/transactions';
import categoryRouter from './routes/categories';
import analyticsRouter from './routes/analytics';
import budgetRouter from './routes/budgets';

const app = express();

app.disable('x-powered-by'); // don't advertise the framework
if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy); // real visitor IP behind Render/Railway
app.use(cors({ origin: config.frontendUrls }));
app.use(express.json({ limit: '100kb' }));

// All API routes live under /api so they never collide with frontend page routes
const api = express.Router();
api.use('/auth', authRouter);
api.use('/transactions', transactionRouter);
api.use('/categories', categoryRouter);
api.use('/analytics', analyticsRouter);
api.use('/budgets', budgetRouter);
api.get('/health', async (_req, res) => {
  await pool.query('SELECT 1'); // also confirms the DB is reachable
  res.json({ status: 'ok' });
});
app.use('/api', api);

// Unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler — logs the real error, sends a generic message (no internals leaked)
app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Run pending migrations, then start. If migrations fail, don't serve on a broken schema.
// The database may still be starting (e.g. `npm run dev:local` launches both at once),
// so retry the first connection for a few seconds before giving up.
async function waitForDatabase(attempts = 10, delayMs = 1000): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'ECONNREFUSED' || i >= attempts) throw err;
      if (i === 1) console.log('⏳ Waiting for the database…');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

waitForDatabase()
  .then(runMigrations)
  .then(() => {
    const server = app.listen(config.port, () => console.log(`🚀 Server running on port ${config.port}`));

    // Hosts send SIGTERM before replacing the instance on a redeploy: finish in-flight
    // requests, close DB connections, then exit (forced after 10s if something hangs)
    const shutdown = (signal: string) => {
      console.log(`${signal} received — shutting down`);
      setTimeout(() => process.exit(1), 10_000).unref();
      server.close(() => {
        pool.end().finally(() => process.exit(0));
      });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    const { code, message } = err as { code?: string; message: string };
    console.error('❌ Startup failed:', message);
    if (code === 'ECONNREFUSED') {
      console.error('   The database is not running. For the local dev database, run `npm run db`');
      console.error('   in another terminal first — or use `npm run dev:local` to start both together.');
    }
    process.exit(1);
  });
