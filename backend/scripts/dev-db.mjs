// Local development database — real Postgres (PGlite, compiled to WebAssembly) running
// inside Node. No install needed. Data is saved to backend/.pgdata and survives restarts.
//
//   npm run db        → keep this running in its own terminal, then `npm run dev`
//
// Matching .env line:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/postgres
//
// Dev only: single process, no password, listens on localhost. Use a real Postgres
// (e.g. AWS RDS) for anything deployed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORT = Number(process.env.DEV_DB_PORT) || 5433; // not 5432, so it never clashes with an installed Postgres
const HOST = '127.0.0.1';
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.pgdata');

let db;
let server;

async function main() {
  db = await PGlite.create({ dataDir: DATA_DIR });
  server = new PGLiteSocketServer({ db, port: PORT, host: HOST, maxConnections: 20 });

  server.addEventListener('error', (event) => {
    console.error('❌ Dev database error:', event.detail?.message ?? event.detail);
  });

  try {
    await server.start();
  } catch (err) {
    if (err?.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use — is the dev database already running in another terminal?`);
    } else {
      console.error('❌ Could not start dev database:', err?.message ?? err);
    }
    await db.close();
    process.exit(1);
  }

  console.log(`✅ Dev database running on ${HOST}:${PORT}`);
  console.log(`   Data folder: ${DATA_DIR}`);
  console.log('   Leave this terminal open. Press Ctrl+C to stop.');
}

// Close cleanly on Ctrl+C so data is flushed to disk
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('\nStopping dev database…');
  try {
    await server?.stop();
    await db?.close();
  } catch (err) {
    console.error('Error while stopping:', err?.message ?? err);
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(async (err) => {
  console.error('❌ Dev database failed to start:', err?.message ?? err);
  process.exit(1);
});
