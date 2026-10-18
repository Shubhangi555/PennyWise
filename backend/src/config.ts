import dotenv from 'dotenv';

const envResult = dotenv.config({ quiet: true });

// Fail fast at startup instead of throwing confusing errors on the first request
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    if (envResult.error) {
      console.error(`   No .env file found in ${process.cwd()}. Create one: copy .env.example to .env and fill it in.`);
    } else {
      console.error('   Add it to backend/.env (see .env.example).');
    }
    process.exit(1);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters — use a long random value');
}

const isProduction = process.env.NODE_ENV === 'production';

// FRONTEND_URL may list several origins, comma-separated (e.g. the vercel.app URL + a custom domain).
// Trailing slashes are dropped: browsers send the Origin header without one.
const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (isProduction && !process.env.FRONTEND_URL) {
  console.warn('⚠️  FRONTEND_URL is not set — the deployed frontend will be blocked by CORS');
}

// TLS to Postgres when the URL doesn't specify sslmode itself:
//   verify (default in production) | no-verify (self-signed certs) | disable (default locally)
const sslMode = process.env.DATABASE_SSL ?? (isProduction ? 'verify' : 'disable');
if (!['verify', 'no-verify', 'disable'].includes(sslMode)) {
  console.error("❌ DATABASE_SSL must be 'verify', 'no-verify' or 'disable'");
  process.exit(1);
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: sslMode as 'verify' | 'no-verify' | 'disable',
  jwtSecret,
  jwtExpiresIn: '7d',
  port: Number(process.env.PORT) || 4000,
  frontendUrls,
  // Number of reverse proxies in front of the app (Render/Railway/a load balancer = 1).
  // Needed so req.ip is the visitor's IP — otherwise every visitor shares one rate limit.
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  isProduction,
} as const;
