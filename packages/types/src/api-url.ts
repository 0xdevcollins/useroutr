/**
 * One definition of where the API lives and who owns the version prefix.
 *
 * There used to be three, and they disagreed. `NEXT_PUBLIC_API_URL` meant
 * "origin, I will add /v1" in the dashboard and "origin including /v1" in
 * checkout. Both were self-consistent, so both looked fine in isolation — but
 * the variable is set once per deployment, so whichever value you picked, one
 * app was wrong: set `https://api.useroutr.com` and checkout dropped the
 * version; set `https://api.useroutr.com/v1` and the dashboard requested
 * `/v1/v1/...`.
 *
 * The rule now: **the base URL owns the version, call sites never write it.**
 * A caller passes `/payments/abc`, not `/v1/payments/abc`. The version belongs
 * to the API surface as a whole, not to each individual call, which is also
 * what makes a future `/v2` a one-line change here rather than a sweep through
 * every hook.
 */

export const API_VERSION = 'v1';

/**
 * Builds the versioned base URL, accepting an origin written either way.
 *
 * Tolerating both spellings is deliberate: this value is typed into deployment
 * dashboards by people who cannot see this file, and a trailing `/v1` is an
 * entirely reasonable thing to write. Normalising is friendlier than a boot
 * error, and far friendlier than the 404s the mismatch used to cause.
 *
 *   resolveApiBaseUrl('https://api.useroutr.com')     → 'https://api.useroutr.com/v1'
 *   resolveApiBaseUrl('https://api.useroutr.com/v1')  → 'https://api.useroutr.com/v1'
 *   resolveApiBaseUrl('https://api.useroutr.com/v1/') → 'https://api.useroutr.com/v1'
 *   resolveApiBaseUrl(undefined, 'http://localhost:3333')
 *                                                     → 'http://localhost:3333/v1'
 */
export function resolveApiBaseUrl(
  rawOrigin: string | undefined | null,
  fallbackOrigin: string,
): string {
  const raw = (rawOrigin ?? '').trim() || fallbackOrigin;

  // Strip trailing slashes, then any number of trailing `/v1` segments, then
  // any slashes those left behind. Repeated rather than single so an origin
  // that already carries the doubled prefix is repaired instead of preserved.
  let origin = raw.replace(/\/+$/, '');
  while (new RegExp(`/${API_VERSION}$`).test(origin)) {
    origin = origin.slice(0, -(API_VERSION.length + 1)).replace(/\/+$/, '');
  }

  return `${origin}/${API_VERSION}`;
}

/**
 * Guards the other half of the contract: that call sites do not add the
 * version themselves.
 *
 * This is the failure the base URL cannot fix on its own. `api.get('/v1/x')`
 * against a correctly versioned base produces `/v1/v1/x`, which 404s at
 * runtime and nowhere else — no type error, no lint error, and the mocked
 * hook tests assert the wrong string right along with it. Twenty call sites
 * accumulated this way before anyone opened a network panel.
 *
 * Throws rather than warns, and only outside production: a 404 in a deployed
 * checkout is worse than a loud failure in development, but a hard throw in
 * front of a paying customer over a path string is worse still.
 */
export function assertVersionlessPath(path: string): void {
  if (process.env.NODE_ENV === 'production') return;

  if (new RegExp(`^/?${API_VERSION}(/|$)`).test(path)) {
    throw new Error(
      `API path "${path}" starts with "/${API_VERSION}", but the client's base URL ` +
        `already includes it — this would request /${API_VERSION}/${API_VERSION}/… ` +
        `Pass "${path.replace(new RegExp(`^/?${API_VERSION}`), '')}" instead.`,
    );
  }
}
