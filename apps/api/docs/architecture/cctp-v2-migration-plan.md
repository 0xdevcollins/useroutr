# CCTP V2 migration plan

**Status:** Draft for sign-off — no code changes have happened yet.
**Owner:** Backend team. Sign off here before PR B opens.

This is the planning artifact for **PR A** of the CCTP V2 rebuild. The
sequence is PR A (this doc) → PR B (additive CCTP V2 module) → PR C
(route policy switch) → PR D (delete dead bridging) → PR E (Gateway
eval — see [`circle-gateway-evaluation.md`](./circle-gateway-evaluation.md))
→ PR F (marketing + status + docs). Phase 1 (Pay-by-link, PRs 5–10) is
paused until this lands.

---

## What changed in the world

Circle's **CCTP V2** is now live on Stellar (announced May 2026).
Stellar is Circle Domain **27**. Native USDC moves between Stellar and 24
other chains via burn-and-mint, in 8–20 seconds (Fast Transfer), with
hook data for atomic destination-side actions and an optional
**Forwarding Service** where Circle covers destination gas.

Our existing `apps/api/src/modules/bridge` was built for the pre-CCTP-V2
world. It bridges via Wormhole for Stellar↔EVM, uses our own HTLC
contracts on 6 EVM chains for atomic swaps, and has a separate
Layerswap provider for Starknet. **All of that becomes redundant for
USDC routes** the moment CCTP V2 ships.

Decision (confirmed by founder): **USDC-only for cross-chain.** Anything
that's not USDC and not same-chain, we don't bridge. This commits us to
Circle's roadmap as the cross-chain backbone in exchange for massive
operational simplification.

---

## Current state — what exists today

### Bridge module (`apps/api/src/modules/bridge/`)

| File | LOC | Role |
|---|---:|---|
| `providers/cctp.service.ts` | 552 | **CCTP V1 client.** Calls `depositForBurn` (no hook data). Polls `/attestations` (V1 endpoint). Domain table covers 5 chains. Header explicitly says "Stellar's CCTP MessageTransmitter is bridged via Wormhole" — premise broken by V2. |
| `providers/wormhole.service.ts` | 628 | Used today as the actual Stellar↔EVM USDC bridge (via Wormhole's CCTP integration). Becomes redundant — CCTP V2 talks to Stellar directly. |
| `providers/layerswap.service.ts` | 551 | Starknet support. Starknet is now Domain 25 in CCTP V2 — Layerswap is fully redundant. |
| `bridge-router.service.ts` | 349 | Decision tree picking provider per `(fromChain, toChain, asset)`. Logic is `stellar_native | layerswap | cctp | wormhole`. |
| `bridge.module.ts` | 21 | Module wiring. |
| `bridge.service.spec.ts` | 38 | Smoke test. |
| **Subtotal** | **2,139** | |

### Relay module (`apps/api/src/modules/relay/`)

| File | LOC | Role |
|---|---:|---|
| `relay.processor.ts` | 240 | BullMQ worker. Watches EVM HTLC unlock events + completes locks. |
| `relay.service.ts` | 311 | Sets up per-chain RPC providers, schedules expiration jobs, manages signers. |
| `relay.module.ts` | 21 | Module wiring. |
| **Subtotal** | **572** | |

Both files have heavy EVM-chain coupling (loops over Ethereum, Base,
BNB, Polygon, Arbitrum, Avalanche). Once HTLCs are gone, the relay
contracts to Stellar-only event watching + Circle attestation polling.

### On-chain contracts

| Path | Status after migration |
|---|---|
| `contract/evm/contracts/HTLCEvm.sol` | **DELETE** (or git-archive). HTLCs are how we did atomic swaps pre-CCTP. Not needed when burn-and-mint is native. |
| `contract/evm/contracts/MockERC20.sol` | DELETE (only used by HTLC tests). |
| `contract/evm/{hardhat.config,test,scripts,artifacts,...}` | DELETE the whole tree. We don't need to deploy or test EVM contracts anymore. Keep in git history. |
| `contract/soroban/contracts/htlc/` | **DELETE.** Same reason — Stellar→EVM atomic swap is replaced by CCTP V2 burn. |
| `contract/soroban/contracts/escrow/` | **KEEP.** Used for payment-link escrow + invoice escrow on Stellar. Not bridging-related. |
| `contract/soroban/contracts/settlement/` | **KEEP.** Settlement bookkeeping on Stellar. Not bridging-related. |
| `contract/soroban/contracts/fee-collector/` | **KEEP.** Platform fee collection. Not bridging-related. |
| `contract/starknet/` | **DELETE.** Was only used through Layerswap, which is gone. |

### Environment variables

| Var | Action | Why |
|---|---|---|
| `HTLC_ADDRESS_ETHEREUM`, `_BASE`, `_BNB`, `_POLYGON`, `_ARBITRUM`, `_AVALANCHE` | DELETE | HTLCs gone |
| `STELLAR_HTLC_CONTRACT_ID`, `SOROBAN_HTLC_CONTRACT_ID` | DELETE | Soroban HTLC gone |
| `RPC_ETHEREUM`, `_BASE`, `_BNB`, `_POLYGON`, `_ARBITRUM`, `_AVALANCHE` | **KEEP** | Still needed for CCTP V2: we need to read transaction receipts on the source side and (if not using Forwarding Service) submit `receiveMessage` on the destination. |
| `EVM_RELAY_PRIVATE_KEY`, `PRIVATE_KEY` | DELETE if Forwarding Service is used for all paths. Keep if we maintain a self-relay fallback. **Plan locked: use Forwarding Service → DELETE.** |
| `LAYERSWAP_API_KEY` | DELETE | Layerswap gone |
| `WORMHOLE_ENV` | DELETE | Wormhole gone |
| `CIRCLE_API_KEY` | **KEEP / RENAME** to `CIRCLE_ATTESTATION_URL` only — V2 polling doesn't require an API key for attestation reads. Fee-estimate endpoint may, TBC. |
| `CCTP_DEFAULT_SPEED` | NEW. `fast` or `standard`. Default `fast`. |
| `CCTP_USE_FORWARDING` | NEW. `true` initially; toggle off if we add self-relay fallback. |
| `CIRCLE_ATTESTATION_URL` | NEW. `https://iris-api-sandbox.circle.com/v2` for testnet, `https://iris-api.circle.com/v2` for mainnet. |

### Bridge consumers (must update)

`grep` against the current tree:

```
apps/api/src/app.module.ts                            ← register CctpModule, drop BridgeModule
apps/api/src/modules/quotes/quotes.module.ts          ← swap dependency
apps/api/src/modules/quotes/quotes.service.ts         ← new route policy
apps/api/src/modules/quotes/quotes.controller.ts      ← likely no change
apps/api/src/modules/quotes/quotes.service.spec.ts    ← update mocks
apps/api/src/modules/relay/relay.module.ts            ← drop bridge import
apps/api/src/modules/relay/relay.processor.ts         ← drop EVM watching, add CCTP attestation polling
apps/api/src/modules/relay/relay.service.ts           ← Stellar-only chain handles
```

### Schema (Prisma)

| Field | Action |
|---|---|
| `Quote.bridgeRoute` | Currently stores `cctp`/`wormhole`/`layerswap`/`stellar_native`. Simplify to either `cctp_v2` or `stellar_native`. Migration: backfill old values → `cctp_v2` (closest equivalent). |
| `Quote.stellarPath` | KEEP — still used for Stellar DEX path finding on same-chain conversions. |
| `Payment.bridgeNonce` | If present, repurpose for CCTP nonce (returned by `depositForBurn`). |

(I'll do the full schema diff in PR D — the actual migration SQL.)

---

## Target state — what exists after migration

### New module: `apps/api/src/modules/cctp/`

```
cctp/
├── cctp.module.ts              (~15 LOC)  module wiring
├── cctp.service.ts             (~300 LOC) high-level: routeTransfer, fees, status
├── attestation.service.ts      (~150 LOC) iris-api polling, rate-limit, retry/backoff
├── forwarder.service.ts        (~150 LOC) Forwarding Service hook-data encoding
├── stellar-cctp.client.ts      (~200 LOC) Stellar-side burn (deposit_for_burn)
├── evm-cctp.client.ts          (~200 LOC) EVM-side burn + mint via viem
├── domains.ts                  (~80 LOC)  full Circle domain table (Stellar = 27, etc.)
├── types.ts                    (~50 LOC)  shared types (TransferRequest, AttestationStatus, etc.)
└── *.spec.ts                   (~600 LOC) tests
```

**Estimated total: ~1,200 LOC** (down from the 2,139 LOC bridge module).

### Slimmed `relay/`

```
relay/
├── relay.module.ts             (unchanged)
├── relay.service.ts            (~100 LOC) Stellar-only chain handle, attestation poll scheduler
├── relay.processor.ts          (~120 LOC) Stellar event watcher + CCTP attestation poller
```

**Estimated total: ~250 LOC** (down from 572).

### Status page + readiness

Add a fourth check to `/readyz`:

```
checks: {
  postgres: { ok, latency_ms }
  redis:    { ok, latency_ms }
  stellar:  { ok, latency_ms, meta: { latest_ledger } }
  circle:   { ok, latency_ms }   ← NEW: pings iris-api/v2/health
}
```

And a new monitor on `status.useroutr.com`:
- "Circle attestation" → pings `https://iris-api.circle.com/v2/health` every 60s
- "External dependencies" component grouping that maps Stellar + Circle together

---

## Net code delta (rough)

| Lane | Lines added | Lines removed |
|---|---:|---:|
| `cctp/` module | +1,200 | — |
| `bridge/` module | — | −2,139 |
| `relay/` slim-down | — | −322 |
| Schema migrations | +40 | — |
| `app.module.ts`, etc. | +10 | −20 |
| Soroban HTLC contract | — | ~−500 |
| EVM HTLC contracts | — | ~−1,500 |
| Starknet contracts | — | ~−500 |
| Tests for new module | (included above) | — |
| Old bridge tests | — | −38 |
| **Net** | **+1,250** | **−5,019** |

≈ 3,800 fewer lines of code in production. Most of the deletion is
on-chain contract code we no longer have to audit, deploy, or maintain.

---

## New runtime topology

```
Customer pays USDC on chain X
        │
        ▼
┌───────────────────────────┐
│ apps/checkout (Phase 2)   │  prompts customer to sign one tx
└──────────┬────────────────┘
           │
           ▼   tx: depositForBurnWithHook (EVM) or deposit_for_burn (Stellar)
┌───────────────────────────────────────────────────────────────┐
│ Source chain                                                  │
│  - TokenMessenger.depositForBurnWithHook(...)                 │
│  - Hook data = forwarder address + Stellar recipient strkey   │
│  - USDC burned                                                │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌───────────────────────────┐
│ Circle attestation service│  signs message after N confirmations
│ (iris-api.circle.com/v2)  │  → ~8-20s for Fast Transfer
└──────────┬────────────────┘
           │  apps/api polls
           ▼
┌───────────────────────────┐
│ apps/api CctpService      │  receives attestation, hands to Forwarder
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────────────────────────────────────────┐
│ Circle Forwarding Service                                     │
│  - Validates hook data                                        │
│  - Signs + broadcasts mint transaction (Circle pays gas)      │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────────────────────────────┐
│ Destination chain (Stellar in 99% of our cases)               │
│  - CctpForwarder.mint_and_forward(message, attestation)       │
│  - USDC minted to merchant settlement address                 │
│  - 7-decimal precision scaling applied on Stellar mint        │
└───────────────────────────────────────────────────────────────┘
```

We hold **no hot wallets on destination chains.** We sign nothing on EVM
after the customer's initial burn. The relay just polls.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Circle attestation API goes down → cross-chain settlement stops | Add to `/readyz` + status page monitor. Retry/backoff in poller. Consider self-relay fallback if downtime > 10 min becomes a pattern. |
| Stellar's 7-decimal USDC vs CCTP message's 6-decimal amount | Explicit unit test for the 10× scaling. Type-tagged amount (e.g., `Cctp.MicroUsdc` vs `Stellar.SubunitUsdc`) to catch mistakes at compile time. |
| Forwarding Service fee changes mid-quote → customer quoted X, charged X + delta | Lock fee at quote time, refresh if quote TTL expires before payment. Pull fee from Circle's fee-estimate API. |
| Stellar strkey encoding into 32-byte CCTP hook data | Centralize encode/decode in one helper with round-trip property tests. |
| Loss of multi-chain optionality (USDC-only commitment) | Documented decision. If we ever need to bridge non-USDC, evaluate then; CCTP doesn't preclude adding a new provider later. |
| Removing 6 EVM HTLC contracts after audit funds were spent on them | Sunk cost. Archive source in git for reference. |
| In-flight payments using the old bridge during cutover | Quote TTL is 30s. Drain by setting `bridgeRoute=cctp_v2` for all new quotes 1h before deleting old code. Migration is safe by design. |

---

## Open questions to lock before PR B opens

1. **Mainnet vs testnet timing.** Are we cutting over to CCTP V2 on testnet first (recommended) or going straight to mainnet? Both endpoints exist (`iris-api-sandbox` vs `iris-api`).
2. **Self-relay fallback.** Confirmed: NO. We use Forwarding Service exclusively, accept Circle as a single point of dependency, monitor it on the status page.
3. **Standard vs Fast Transfer default.** Recommend **Fast** for amounts < $10k (small fee, fast UX). Standard for institutional > $10k (free, but 15-19 min). Configurable per merchant later.
4. **Schema migration timing.** Drop the old bridge-route values in PR D, or write a backfill migration in PR C? Recommend backfill in PR C so PR D is purely code deletion.
5. **Soroban HTLC contract deprecation window.** It's still referenced in code. PR D drops the references; on-chain contract stays deployed but unused. We're not migrating live HTLCs (there are none on mainnet yet).

---

## Sign-off checklist

- [ ] Founder agrees: USDC-only for cross-chain, no other tokens bridged
- [ ] Founder agrees: Forwarding Service exclusively (no self-relay fallback in v1)
- [ ] Founder agrees: testnet cutover first, mainnet after smoke tests pass
- [ ] Founder agrees: Fast Transfer default (configurable per quote)
- [ ] Founder agrees: archive HTLC + Layerswap source rather than fully delete (keep git history)
- [ ] Founder agrees: pause Phase 1 PRs 5–10 until PR D ships

Once all six boxes are ticked, PR B opens.
