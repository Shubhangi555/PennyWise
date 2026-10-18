import { Pool, types } from 'pg';
import { config } from './config';

// DATE (oid 1082): return the raw 'YYYY-MM-DD' string. By default pg converts it to a
// JS Date at local midnight, which serialises to the previous day in UTC (e.g. IST).
types.setTypeParser(1082, (value) => value);

// NUMERIC (oid 1700): return a number instead of a string. Safe for NUMERIC(12,2) amounts
// and their sums, which stay well within double precision.
types.setTypeParser(1700, (value) => parseFloat(value));

// An sslmode in DATABASE_URL (e.g. Neon's ?sslmode=require) takes precedence over this.
const ssl =
  config.databaseSsl === 'verify' ? { rejectUnauthorized: true }     // check the server's certificate
  : config.databaseSsl === 'no-verify' ? { rejectUnauthorized: false } // encrypted, cert not checked
  : false;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl,
  max: 10, // small hosted databases (Neon free tier, etc.) cap concurrent connections
});

// An idle client erroring (e.g. the DB restarted) must not crash the process
pool.on('error', (err) => console.error('Postgres pool error:', err.message));
