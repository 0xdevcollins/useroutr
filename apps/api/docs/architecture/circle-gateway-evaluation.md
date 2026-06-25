# Circle Gateway evaluation

**Status:** Decision document for sign-off. No code changes.
**Owner:** Backend team. Sign off here before PR F opens.
**Verdict (TL;DR):** **Pass on Gateway for now. Stay on CCTP V2 + Forwarding Service.** Revisit if Stellar lands on Gateway mainnet, or if Tavvio adds high-frequency / treasury use cases.

This is PR **E** of the CCTP V2 rebuild — the last decision gate before
PR F (marketing + status page + docs). The sequence is PR A (migration
plan) → PR B (additive CCTP module) → PR C (route policy) → PR D
(delete dead bridging) → PR D-follow-up (HTLC strip + schema drop) →
**PR E (this doc)** → PR F.

---

## What Gateway is

Circle **Gateway** is a separate Circle product from CCTP. Where CCTP
burns USDC on chain A and mints fresh USDC on chain B, Gateway gives a
holder a **single unified USDC balance** that's spendable on any
supported chain in **<500ms**, by signing an offchain permit that
debits their Gateway balance and credits the destination chain.

**Operational model:**

1. User deposits USDC into the Gateway contract on chain A (one-time).
2. Their balance shows up as a unified `available_on_chains:[…]`
   spendable across every Gateway chain.
3. To spend on chain B, the user signs an offchain attestation; Circle
   relays the mint on chain B in <500ms.
4. Circle handles the eventual rebalancing of the underlying USDC
   between chains.

Compared to CCTP V2 + Forwarding Service:

| | CCTP V2 + Forwarding | Gateway |
|---|---|---|
| **Settlement** | Burn-and-mint, ~8–20s Fast Transfer | Pre-funded balance, <500ms |
| **User setup** | None — sign one burn tx per payment | Must pre-deposit into Gateway contract first |
| **Capital model** | Linear, 1:1, capital moves with each payment | Aggregated — capital sits in a unified pool |
| **Onchain shape** | Push-based hooks; works with any wallet that can sign a burn | Pull-based; relies on Circle's offchain attestation flow |
| **Gas on destination** | Forwarding Service (Circle pays) | Circle pays |
| **Failure mode** | If Iris/Forwarding is down, payment retries when it returns | If Gateway is down, the unified balance becomes unspendable |

---

## What this means for Tavvio

### Reason 1: Stellar isn't supported

Gateway's mainnet list (as of May 2026):

> **Mainnet:** Arbitrum, Avalanche, Base, Ethereum, HyperEVM, OP, Polygon PoS, Sei, Solana, Sonic, Unichain, World Chain.

**Stellar is not on the list, and not on the testnet list either.**

Our settlement asset is USDC on Stellar — the merchant always wants
USDC landing on their Stellar address (or wallet linked to their
Stellar account). That's the leg Gateway can't currently do. Even if we
adopted Gateway for the inbound (payer → us) leg on a supported EVM
chain, we'd still need CCTP V2 to get the funds onto Stellar. We'd be
running two bridges in parallel for zero benefit on >99% of our
volume.

### Reason 2: Wrong model for one-time customer payments

Gateway's design assumption is that the **holder** of the USDC is the
one moving it — corporate treasury, market-maker, exchange. Tavvio's
flow is the opposite: an unknown customer pays a one-time amount they
have **not** previously deposited into Circle's Gateway contract.
Asking customers to:

1. Deposit USDC into Circle's Gateway contract on chain A
2. Wait for that deposit to confirm
3. *Then* spend it via offchain permit

…just to make a single payment is a non-starter for checkout. The
whole point of `apps/checkout` is "sign one transaction, done." CCTP V2
+ Forwarding Service is **exactly** that: one burn tx, Circle handles
the rest.

Circle's own decision guide ([their blog post][gateway-vs-cctp])
agrees:

| Choose Gateway for | Choose CCTP + Forwarding for |
|---|---|
| Sub-second latency requirements | Vendor payments and supply chain settlements |
| Corporate treasury rebalancing across 5+ chains | Single-step user onboarding without prior deposit requirements |
| Frequent, repeated transactions where setup costs amortize | Discrete payment flows where reliable end-to-end completion matters more than sub-second speed |

The right-hand column is a verbatim description of Tavvio's flow.

### Reason 3: Stripe agrees

Stripe's 2025 stablecoin payment product (the closest peer to Tavvio in
shape) uses **CCTP**, not Gateway, to move merchant USDC across chains.
If the largest stablecoin checkout product in the world picked CCTP for
the same problem, we should not be the contrarian until we have a
specific reason.

---

## When Gateway becomes interesting

Three triggers for revisiting:

1. **Stellar lands on Gateway mainnet.** Then we could let merchants
   hold a unified Tavvio balance instead of per-chain settlement
   addresses. This becomes a feature for power users, not a
   replacement for CCTP.
2. **Tavvio launches treasury / FX / payout-on-demand.** If we
   eventually offer merchants a "spend your USDC instantly on any
   chain" experience (think: virtual cards, instant payouts to local
   currency rails on chain B), Gateway is the right primitive — the
   merchant *is* the holder.
3. **High-frequency batch settlement.** If we move to settling many
   small payments in one cross-chain operation per hour, Gateway's
   sub-second latency starts to matter. Today, with quote TTL of 30s
   and per-payment burn, CCTP's 8–20s window is invisible.

We'll re-open this doc when any of those land.

---

## What we add to PR F to reflect this

Marketing copy + docs should not promise Gateway support. Specifically:

- **Marketing site (`apps/www`)** — keep the existing "powered by
  Circle's Cross-Chain Transfer Protocol V2" claim. Do **not** add
  Gateway to the bridge logo strip / partner list.
- **Docs site / API reference** — under "Cross-chain settlement,"
  describe CCTP V2 + Forwarding Service as the only path. No mention
  of Gateway except in a forward-looking "What's next" footnote (if
  even that).
- **Status page (`status.useroutr.com`)** — monitors only the CCTP V2
  dependency (`iris-api.circle.com/v2/health`). No Gateway monitor.
- **Internal architecture doc** — link this evaluation from
  `cctp-v2-migration-plan.md` so the "why not Gateway" decision is
  discoverable.

---

## What we are **not** building

- No `apps/api/src/modules/gateway/` module.
- No Gateway-specific env vars in `.env.example`.
- No `bridgeRoute = 'gateway'` value in `Quote.bridgeRoute`.
- No Gateway client SDK dependency in `package.json`.

The CCTP V2 module (`apps/api/src/modules/cctp/`) remains the sole
cross-chain bridge.

---

## Sign-off checklist

- [ ] Founder agrees: pass on Gateway integration in v1
- [ ] Founder agrees: revisit only if (a) Stellar joins Gateway mainnet, (b) Tavvio launches treasury/payout-on-demand, or (c) batch-settlement use case emerges
- [ ] Founder agrees: marketing + docs (PR F) say "CCTP V2" only, no Gateway claim
- [ ] Founder agrees: no Gateway code, env vars, or schema fields land in v1

Once all four boxes are ticked, PR F opens.

---

## Sources

- [Gateway Supported Blockchains — Circle Docs](https://developers.circle.com/gateway/references/supported-blockchains)
- [Gateway vs Forwarding Service for Crosschain USDC — Circle Blog][gateway-vs-cctp]
- [Gateway product page — Circle](https://www.circle.com/gateway)
- [Circle Deploys CCTP on Stellar — BanklessTimes (2026-05-20)](https://www.banklesstimes.com/articles/2026/05/20/circle-deploys-cctp-on-stellar-to-power-seamless-native-usdc-transfers/)
- [USDC Cross-Chain Transfers: How Circle's Gateway and CCTP V2 Are Revolutionizing Blockchain Liquidity — OKX](https://www.okx.com/en-us/learn/usdc-cross-chain-transfers-circle-gateway-cctp)

[gateway-vs-cctp]: https://www.circle.com/blog/choosing-between-circle-gateway-and-cctp-with-forwarding-service-for-crosschain-usdc
