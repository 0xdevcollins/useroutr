import { NextResponse } from "next/server";

/**
 * Proxies the API's `/readyz` aggregate into a simplified shape the
 * marketing footer can render. The upstream check already fans out to
 * Postgres, Redis, Stellar, Circle, and BetterStack — we just summarize.
 *
 * Cached for 30s so a hot landing page doesn't hammer `/readyz` (and so
 * the pill is consistent across users on the same edge node).
 */

export const revalidate = 30;

type Health = "operational" | "degraded" | "unknown";

interface ReadyzCheck {
  ok: boolean;
}

interface ReadyzResponse {
  ok: boolean;
  checks?: Record<string, ReadyzCheck>;
}

const FETCH_TIMEOUT_MS = 4_000;

export async function GET() {
  const apiUrl = process.env.API_URL ?? "http://localhost:3333";

  try {
    const res = await fetch(`${apiUrl}/readyz`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });

    // /readyz returns 200 on green, 503 on any failed check. Both shapes
    // include a JSON body we can read.
    const body = (await res.json().catch(() => null)) as ReadyzResponse | null;

    if (res.ok && body?.ok) {
      return NextResponse.json({ status: "operational" satisfies Health });
    }

    return NextResponse.json({
      status: "degraded" satisfies Health,
      failing: failingChecks(body),
    });
  } catch {
    // Couldn't reach the API at all — render the pill as unknown rather
    // than lying with "operational".
    return NextResponse.json({ status: "unknown" satisfies Health });
  }
}

function failingChecks(body: ReadyzResponse | null): string[] {
  if (!body?.checks) return [];
  return Object.entries(body.checks)
    .filter(([, c]) => !c.ok)
    .map(([name]) => name);
}
