import { pool } from './db';
import { runMigrations } from './migrator';

// Standalone runner: `npm run migrate`
runMigrations()
  .then(() => console.log('✅ Database is up to date'))
  .catch((err) => {
    console.error('❌', (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
