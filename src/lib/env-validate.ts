/**
 * Startup environment validation.
 *
 * Production crashes mid-OAuth-callback are awful to debug. If a required
 * secret isn't set, fail loudly the moment the server boots so the deploy
 * is obviously broken instead of silently broken.
 *
 * Only enforced when `import.meta.env.PROD` is true (i.e., `astro build`
 * artifacts running in the container). Skipped in dev so `task dev` works
 * without secrets.
 */

interface EnvSpec {
  key: string;
  reason: string;
}

const REQUIRED_IN_PROD: EnvSpec[] = [
  { key: 'SITE_URL', reason: 'CSRF origin check + OAuth callback URLs' },
  { key: 'GOOGLE_CLIENT_ID', reason: 'Google OAuth login' },
  { key: 'GOOGLE_CLIENT_SECRET', reason: 'Google OAuth login' },
  { key: 'GOOGLE_MAPS_API_KEY', reason: 'Address geocoding for property submissions' },
];

function getEnv(key: string): string {
  return import.meta.env?.[key] || process.env[key] || '';
}

/**
 * Pure form for tests: returns the list of missing required keys.
 */
export function findMissingEnv(specs: EnvSpec[], lookup: (k: string) => string): EnvSpec[] {
  return specs.filter((s) => !lookup(s.key));
}

export function validateRequiredEnv(): void {
  if (!import.meta.env.PROD) return;
  const missing = findMissingEnv(REQUIRED_IN_PROD, getEnv);
  if (missing.length === 0) return;

  const lines = missing.map((s) => `  - ${s.key}: ${s.reason}`).join('\n');
  throw new Error(
    `Missing required environment variables in production:\n${lines}\n` +
      'Set these in the lighttheham-oauth / lighttheham-google-maps ExternalSecrets.',
  );
}
