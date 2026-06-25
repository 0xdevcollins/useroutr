/**
 * Site-wide config. Anything that varies between environments (dev / staging
 * / prod) reads from here instead of being hardcoded in components.
 */

/**
 * URL of the dashboard / authenticated product app. CTAs that take the user
 * out of the marketing site (Sign in, Open an account once beta is open)
 * should resolve through `appUrl(path)` so we don't sprinkle hardcoded
 * hosts across components.
 *
 * Set `NEXT_PUBLIC_APP_URL` in `.env.local` for dev, in your hosting
 * provider for staging/prod. Falls back to the local dashboard port so
 * a fresh clone works without configuration.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

/** Build a full URL into the dashboard app. */
export function appUrl(path = "/"): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Common dashboard entry points — use these so dashboard route changes
 * (e.g. `/register` → `/signup`) only need updating in one place.
 */
export const APP_ROUTES = {
  login: () => appUrl("/login"),
  register: () => appUrl("/register"),
  forgotPassword: () => appUrl("/forgot-password"),
  dashboard: () => appUrl("/"),
};
