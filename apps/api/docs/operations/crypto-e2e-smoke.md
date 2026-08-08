# Crypto E2E smoke: Base Sepolia → Stellar testnet

A real USDC burn on Base Sepolia, attested by Circle, minted to a merchant's
Stellar testnet wallet. Unit tests cover the code paths; this is the only thing
that proves the round-trip.

Budget ~15 minutes once you have funded wallets. Getting testnet USDC the first
time takes longer — do that part first.

> Deliverable 2 of #146. Deliverable 1 is running this at least once and pasting
> the result into the issue.

---

## 1. Fund a source wallet (once)

| | |
| --- | --- |
| Network | Base Sepolia — chain ID `84532`, RPC `https://sepolia.base.org` |
| Explorer | <https://sepolia.basescan.org> |
| Gas | <https://www.alchemy.com/faucets/base-sepolia> |
| USDC | <https://faucet.circle.com/> → "Base Sepolia" → ~10 USDC |

Add the network to MetaMask and confirm both balances are non-zero before
continuing. A burn with no gas fails at signature time and tells you nothing.

## 2. Bring up the stack

```bash
docker compose up -d postgres redis
cd apps/api && npx prisma migrate deploy && npx prisma generate
```

`prisma generate` is not optional — the API will not boot against a stale client
(`PayoutsService.onApplicationBootstrap` reads `prisma.recurringPayout`).

Then, from the repo root:

```bash
npm run start:api        # API
npm run dev:checkout     # checkout
npm run dev:dashboard    # dashboard
```

The API listens on `PORT` from `apps/api/.env`, defaulting to **3000** — check
yours rather than assuming; #146 says 3333, which is only true if your `.env`
says so. Ports for the rest are in the root README.

`apps/api/.env` must have:

- `STELLAR_NETWORK=testnet`
- `SETTLEMENT_KEY_KEK` — any 32-byte hex; it encrypts the merchant settlement seed
- `JWT_SECRET` — **at least 32 characters**, or the API exits at boot with an
  `EnvValidation` error. `./scripts/generate-secrets.sh` produces valid ones.

## 3. Register a merchant and confirm its wallet

The destination side provisions itself: a new merchant gets a Stellar testnet
wallet, Friendbot-funded, with a USDC trustline to the testnet issuer
`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.

1. Sign up at `http://localhost:3001/signup` with a throwaway address —
   `smoke+$(date +%s)@example.com`
2. `/settings` → the "Settlement wallet" card should read **Settlement active**
   with a `G…` address. Copy it.
3. Confirm it is real before relying on it:
   <https://stellar.expert/explorer/testnet/account/G…> — the account should
   exist and hold a USDC trustline.

If the card is not green, stop. Everything downstream mints into nothing.

## 4. Create something to pay

Either a payment link from the dashboard `/links`, or directly:

```bash
curl -X POST http://localhost:3000/v1/payments \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"amount": 1.00, "currency": "USD"}'
```

Open the checkout URL and pick **Base Sepolia** as the source chain.

## 5. Pay, and watch it move

What the checkout does, and where to look when a step does not happen:

| # | Step | Endpoint | Observable |
| --- | --- | --- | --- |
| 1 | Order summary loads | `GET /v1/payments/checkout/:id` | Amount and merchant render |
| 2 | Quote locks | `GET /v1/payments/checkout/:id/quote` | Rate shown, 30s TTL |
| 3 | Chain selected | `POST /v1/payments/checkout/:id/select-crypto` | Response carries **server-generated** `wallet.approve` and `wallet.burn` calldata |
| 4 | Payer signs approve | — | MetaMask prompt 1: `approve(USDC, TokenMessengerV2, amount)` |
| 5 | Payer signs burn | — | MetaMask prompt 2 — this is the irreversible one |
| 6 | Burn reported | `POST /v1/payments/checkout/:id/burn-submitted` | Body needs `sourceTxHash` as `0x` + 64 hex, or it 400s |
| 7 | Status `SOURCE_LOCKED` | — | A `cctp.observe` job is enqueued |
| 8 | Status `PROCESSING` | worker | Attestation complete; `cctpNonce` + `cctpAttestation` written to the row |
| 9 | Status `COMPLETED` | worker | Circle's Forwarding Service minted on Stellar; `destTxHash` recorded, webhook fires |

Nothing in step 3 is built client-side. The API is the only place that knows the
CCTP V2 ABI, and it hands back both the addresses and the calldata — that is why
there are no hardcoded contract addresses in `apps/checkout` (see #105).

Poll status without the UI:

```bash
curl -s http://localhost:3000/v1/payments/checkout/$PAYMENT_ID/crypto-status | jq
```

Follow the worker:

```bash
docker compose logs -f api          # containerised
# or read the `npm run start:api` output directly
```

## 6. Confirm the money arrived

The dashboard saying `COMPLETED` is our claim. Verify it independently:

1. Source burn on <https://sepolia.basescan.org/tx/0x…>
2. Destination mint —
   <https://stellar.expert/explorer/testnet/account/G…> should show an incoming
   USDC payment matching `destTxHash`
3. The merchant's USDC balance moved by the expected amount

A payment marked `COMPLETED` whose merchant balance did not move is the failure
this whole exercise exists to catch. Do not skip step 3.

---

## When it stalls

**Stuck in `PROCESSING`, never reaches `COMPLETED`.** Expected in one specific
case: Circle's attestation came back without a `forwardTxHash`, meaning the
Forwarding Service did not broadcast the mint. v1 has no self-relay path, so the
worker logs `self-relay path not implemented in v1` and leaves the payment for
manual reconciliation. That is by design, not a hang — check the logs for that
line before assuming a bug.

**Goes to `FAILED`.** The worker retries the observe job three times with
backoff at 5s / 30s / 120s (`CCTP_RETRY_DELAYS_MS`). After the last attempt it
sets `FAILED` and stashes the reason in `payment.metadata.cctpError`:

```bash
psql "$DATABASE_URL" -c \
  "select status, metadata->>'cctpError' from \"Payment\" where id = '$PAYMENT_ID';"
```

Common causes: Iris unreachable, or source-chain finality stalled so the burn
receipt is not yet queryable.

**`burn-submitted` returns 400.** The hash must be `0x` plus exactly 64 hex
characters. MetaMask sometimes shows a truncated hash in its UI — take it from
Basescan.

**Nothing happens after the burn.** Confirm Redis is up and BullMQ is draining;
the observe job is queued, not run inline. `docker compose ps` and check the
`cctp.observe` queue.

## What this does not cover

- **The escrow contract.** `SOROBAN_ESCROW_CONTRACT_ID` is not read anywhere in
  `apps/api/src` — the contract is deployed and tested but not yet wired into
  the payment flow, so no amount of exercising the API touches it.
- **Refunds.** The CCTP refund path is untested here.
- **Stellar-native payments** (payer already on Stellar) — a different flow that
  does not go through CCTP at all.
