# Status page (status.useroutr.com)

Public uptime + incident history page hosted on **Better Stack**. Backed by
external monitors that ping our `/readyz` endpoint and the public-facing
surfaces (dashboard, marketing, docs).

Customers see uptime over the last 90 days, current incident state, and
historical postmortems. Internal team sees the same plus on-call routing
and alert wiring.

---

## What this page is for

- Single canonical answer to "is Useroutr up right now?"
- Visible record of past incidents — builds integrator trust
- Trigger point for incident comms (post update once → it pushes to status page banner, RSS, email subscribers, Slack channels)
- Driven by **external probes**, not self-reported. If the API is too broken to talk, the probe still fires.

## What it is NOT

- Not a debugging tool — engineers use Grafana / Sentry / logs for that.
- Not a SLA contract — SLA promises live in the MSA, not on this page.
- Not real-time customer support — customers in the chat get human responses; the status page is a calmer broadcast surface.

---

## Architecture

```
                    ┌──────────────────────────┐
                    │  Better Stack (uptime)   │
                    │  Probes from 6 regions   │
                    │  every 60 seconds        │
                    └────────────┬─────────────┘
                                 │ HTTPS GET
                ┌────────────────┼─────────────────┐
                ▼                ▼                 ▼
       api.useroutr.com    app.useroutr.com   useroutr.com    iris-api.circle.com
          /readyz                /                 /                 /
              │
              └──> Postgres + Redis + Stellar Horizon + Circle Iris probes
                   (inline, < 3s budget per external dep)

  ┌──────────────────────────┐         ┌──────────────────────────┐
  │  Better Stack status     │ ──────► │  status.useroutr.com     │
  │  page component model    │         │  (CNAME)                 │
  └────────────┬─────────────┘         └──────────────────────────┘
               │  incident webhook
               ▼
  Slack #incidents · on-call email · subscribed customers
```

---

## One-time setup

### 1. Create Better Stack account

1. Go to <https://betterstack.com> and sign up with the `ops@useroutr.com` shared mailbox (so the account doesn't belong to a single person).
2. Add at least one secondary owner from the team.
3. Create a workspace named `useroutr`.
4. Free tier covers the Phase 1 footprint (up to ~10 monitors, 60s interval, 6 regions). Upgrade to Team ($29/mo) once we cross that or want SMS alerts.

### 2. Create monitors

| Name | URL | Method | Expected | Interval | Regions |
|---|---|---|---|---|---|
| API readiness | `https://api.useroutr.com/readyz` | GET | HTTP 200 | 60s | US-East, US-West, EU-West, AP-South |
| API liveness | `https://api.useroutr.com/healthz` | GET | HTTP 200 | 60s | US-East, EU-West |
| Circle attestation | `https://iris-api.circle.com/` | GET | HTTP <500 | 60s | US-East, EU-West |
| Dashboard | `https://app.useroutr.com` | GET | HTTP 200 | 60s | US-East, EU-West |
| Marketing | `https://useroutr.com` | GET | HTTP 200 | 60s | US-East, EU-West |
| Docs | `https://docs.useroutr.com` | GET | HTTP 200 | 60s | US-East, EU-West |

**Why `/readyz` as the canonical probe:** liveness only proves the process is alive — it can't tell us if Postgres / Redis / Stellar Horizon / Circle Iris are reachable. Readiness fans out to all four dependencies and returns `503` if any are down, so a failing `/readyz` triggers the right incident shape ("the API is up but can't talk to Stellar" vs "the API is hard-down").

**Why the standalone Circle monitor:** `/readyz` will already surface Iris outages as a 503, but a separate external probe of `iris-api.circle.com` lets us distinguish "Circle is down for everyone" from "our API can't reach Circle." This matters because the response is different: the first is a Circle status-page reference + customer comms, the second is a network / firewall investigation on our side.

### 3. Create the status page

In Better Stack → Status pages → new page:

1. **Public URL:** `status.useroutr.com`
2. **Theme:** dark, brand orange `#ff5b1f`
3. **Logo:** `/brand-mark/useroutr-wordmark.svg` (export from press kit at 320×80)
4. **Components** (each maps to a monitor):
   - `Public API` ← API readiness monitor
   - `Dashboard` ← Dashboard monitor
   - `Marketing site` ← Marketing monitor
   - `Documentation` ← Docs monitor
   - **Component group: `External dependencies`** (collapsed by default)
     - `Stellar Horizon` ← surfaced from `/readyz` (no separate monitor — Stellar's own status page is the source of truth, we just reflect the impact)
     - `Circle Iris (CCTP V2)` ← Circle attestation monitor
5. **Subscriber preferences:** allow email, Slack, RSS, Atom subscription. Disable SMS (cost) until we have paying customers asking for it.

### 4. DNS

Add a single CNAME at the registrar (Cloudflare / Route53 / whoever owns useroutr.com):

```
status.useroutr.com    CNAME    status.betterstack.com.    300
```

Better Stack auto-provisions a Let's Encrypt cert. Verify in ~5 min: `curl -I https://status.useroutr.com`.

### 5. Slack alerts

1. In Better Stack → Integrations → Slack, add a webhook to `#incidents` (create the channel first if missing).
2. Route triggers:
   - **Any monitor down** → page on-call + post to `#incidents`
   - **Any monitor recovered** → post to `#incidents` only
   - **Incident created/updated on status page** → post to `#incidents`

---

## Health endpoints in this app

Mounted outside the `/v1` prefix on purpose — external monitors should not
have to track API version cuts.

| Endpoint | Purpose | Auth | Throttle |
|---|---|---|---|
| `GET /healthz` | Liveness — "is the process responding?" | none | skipped |
| `GET /readyz`  | Readiness — "can it actually do work?" | none | skipped |

`/healthz` always returns `200 { "status": "ok" }`. The load balancer uses
this to decide whether to keep an instance in rotation.

`/readyz` fans out to Postgres (`SELECT 1`), Redis (`PING`), Stellar
Horizon (GET `/`), Circle Iris (GET `/`), and BetterStack's Uptime API
(GET `/api/v2/monitors`) — the external probes each capped at 3 seconds.
Response body:

```json
{
  "ok": true,
  "checks": {
    "postgres":    { "ok": true, "latency_ms": 9 },
    "redis":       { "ok": true, "latency_ms": 5 },
    "stellar":     { "ok": true, "latency_ms": 412, "meta": { "latest_ledger": 2714403 } },
    "circle":      { "ok": true, "latency_ms": 138, "meta": { "env": "testnet" } },
    "betterstack": { "ok": true, "latency_ms": 184, "meta": { "total": 6, "active": 6 } }
  }
}
```

The `betterstack` check exists to catch the silent failure mode where
nobody is actually watching us — API key revoked, monitors all paused,
account suspended. It deliberately ignores individual monitor state
(one of those monitors is `/readyz` itself, so reflecting its own state
would create a feedback loop) and only asserts the watchdog is wired.

The `circle` check pings `iris-api-sandbox.circle.com` on testnet or
`iris-api.circle.com` on mainnet (driven by `STELLAR_NETWORK`). It treats
any 1xx/2xx/3xx/4xx as "reachable" — only network failures and 5xx
responses fail the check, since Iris's root may return 404 depending on
deployment but that still proves the host is alive.

Returns **200** if all checks ok, **503** otherwise. Better Stack alerts on
non-200.

---

## Incident playbook

When a monitor goes red:

1. **Acknowledge** the alert in Better Stack within 5 minutes (resets the timer; otherwise it pages the next on-call).
2. **Declare the incident** on the status page even if you don't yet know the cause. A line like _"We're investigating elevated error rates on the API."_ is enough. Customers prefer "we know" to silence.
3. **Set affected components** to `Degraded performance` or `Major outage` depending on impact.
4. **Post updates every 30 min** until resolved — even if there's nothing new ("Still investigating, no ETA yet" is a valid update).
5. **Mark resolved** when monitors recover for 5 consecutive minutes.
6. **Write a postmortem** within 48 hours and attach it to the incident on the status page. Keep it blameless.

For dev-environment debugging (Postgres down, Redis down) see
`apps/api/docs/operations/debugging-readyz.md` (TODO once we have one).

---

## Environment variables this depends on

| Var | Purpose | Required? |
|---|---|---|
| `STELLAR_HORIZON_URL` | Used by `/readyz` for the Stellar probe | yes (defaults to mainnet) |
| `STELLAR_NETWORK` | Drives which Iris endpoint the Circle probe hits (testnet → iris-api-sandbox, mainnet → iris-api) | yes (defaults to testnet) |
| `REDIS_URL` | Used by `/readyz` for the Redis probe | yes |
| `DATABASE_URL` | Used by `/readyz` for the Postgres probe | yes |
| `BETTERSTACK_API_KEY` | Read-only Uptime API token. `/readyz` calls `GET /api/v2/monitors` with it to confirm the watchdog is alive. | yes (without it, `/readyz` returns 503) |

If we later want to push incidents from the API into Better Stack
(auto-create when a queue fills up), we'll add a `BETTERSTACK_INGEST_KEY`
alongside the read token.

---

## Cost projection

| Tier | Monitors | Status pages | Cost |
|---|---|---|---|
| Free | up to 10 | 1 | $0 |
| Team | up to 50 | 3 | $29/mo |
| Business | up to 200 | unlimited | $79/mo |

Phase 1 fits the free tier. Plan to upgrade to Team when we add synthetic
transaction monitors (PR 10) — each adds ~3 sub-monitors and we'll cross
the free limit.

---

## Checklist for the operator setting this up

- [ ] Sign up for Better Stack with `ops@useroutr.com`
- [ ] Add 6 monitors per the table above
- [ ] Create the status page with 4 top-level components + the `External dependencies` group
- [ ] Add the DNS CNAME for `status.useroutr.com`
- [ ] Verify TLS cert provisioned: `curl -I https://status.useroutr.com`
- [ ] Connect Slack webhook to `#incidents`
- [ ] Set on-call rotation (start with single on-call, add weekly rotation when team > 2 engineers)
- [ ] Trigger a manual incident to test the full notification path before going live
