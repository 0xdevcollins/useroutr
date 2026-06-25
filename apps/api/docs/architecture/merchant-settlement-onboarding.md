# Merchant settlement onboarding

**Status:** Plan for sign-off — no code has landed.
**Owner:** Product + backend. Sign off before implementation begins.
**Scope:** How a business merchant gets a working Stellar settlement
address from "I just signed up" to "I can accept USDC payments."

This doc exists because of a real product gap surfaced in PR 7.8c
testing: a merchant signed up, generated a payment link, and the
customer hit a wall at the crypto pay step with:

> "Merchant has not configured a Stellar settlement address yet. Crypto
> pay is unavailable for this merchant."

The technical "fix" was to ask the merchant to (a) install/visit Stellar
Laboratory, (b) generate a keypair, (c) fund it via Friendbot, (d) add
a USDC trustline manually, (e) PATCH the settlement endpoint via curl.
That's six developer steps to do one business action ("accept crypto
payments"). Businesses won't do it. We need the standard
business-onboarding shape.

---

## What "the standard" looks like in peer platforms

| Platform | Settlement onboarding |
|---|---|
| **Stripe** | "Connect your bank" — Stripe owns the rails. Merchant plugs in routing + account in 30 seconds. |
| **Coinbase Commerce** | Auto-provisioned wallet at signup (custodial). Merchant can withdraw to their own wallet anytime. |
| **OpenNode** | Auto-provisioned BTC wallet. Lightning Network channels opened on their behalf. |
| **Bridge.xyz** | Auto-provisioned USDC settlement address. Merchant verifies a bank account to off-ramp. |

The shared pattern: **the merchant should not have to know what a
trustline is, let alone open one manually.** The platform either
provisions for them (custodial) or guides them through a 1-click
non-custodial wallet creation.

---

## The three viable approaches for Useroutr

### Approach A — Sponsored, platform-managed settlement account

We auto-create a Stellar account during merchant registration. We pay
the reserves and trustline cost. We hold the secret key, encrypted with
a KMS-derived key, accessible only to the API for signing withdrawals.

**Flow:**
1. Merchant clicks "Sign up" → fills email + password
2. Backend creates Stellar account via Friendbot (testnet) or sponsored
   create-account op (mainnet, ~3 XLM reserve sponsored by Useroutr)
3. Backend adds USDC trustline
4. Backend stores `settlementAddress` (public G…) on the Merchant row
   and encrypted seed in a new `MerchantSettlementKey` table
5. Merchant lands in dashboard with crypto pay already working

**Pros:**
- Zero friction. Identical to Stripe's "connect a bank" UX in ease.
- Fastest to ship (~1 day of work).
- All merchants can accept crypto immediately.

**Cons:**
- Custodial: we hold the seed. Breaks the "non-custodial by
  architecture" promise on the marketing site.
- Operating cost: we pay XLM reserves + sponsor mainnet trustlines
  (~$1–2 per merchant in current XLM). At scale this is a real line
  item.
- Compliance lift: holding seeds = money transmitter exposure even if
  the merchant "owns" the address.
- Withdrawal UX: merchant needs a way to move funds out, which means
  a "withdraw to your wallet" feature we don't have.

### Approach B — Passkey-derived wallet (true non-custodial)

Merchant clicks "Set up settlement" → triggers WebAuthn passkey → key
is derived from the passkey signature. We never see the seed; the
merchant signs with their device's biometric.

The Stellar ecosystem now has **Passkey Kit** (kalepail/passkey-kit)
which wraps Soroban smart wallets with passkey signing. Smart contract
wallets on Stellar are mature as of late 2025.

**Flow:**
1. Merchant signs up → dashboard prompts "Set up settlement (1-click)"
2. Browser prompts for passkey → user taps Touch ID / Face ID / YubiKey
3. Frontend derives the keypair from the passkey signature
4. Public G… returned to API, stored as `settlementAddress`
5. Trustline added in the same client-side tx (signed by the new key)
6. Merchant lands back in dashboard with crypto pay working

**Pros:**
- Truly non-custodial — the marketing claim holds.
- No compliance lift on our side: we never touch the key.
- No XLM reserve cost on us (merchant or sponsorship layer pays).
- Future-proof: passkey UX is what consumer wallets are converging on.

**Cons:**
- Implementation cost: ~3–5 days. Passkey Kit is good but new; needs
  careful testing across browsers + iOS Safari + cross-device sync.
- Browser support: WebAuthn requires HTTPS, modern browsers (covered
  for ~98% of business users, but the long tail will fall back).
- Recovery: if the merchant loses every device with the passkey, the
  account is gone. Need a recovery story (Passkey Kit's
  `addSecondaryDevice` flow, but it's still rough).
- We still need to **sponsor the reserves** (an account can't exist on
  Stellar without 1 XLM + 0.5 XLM per trustline). Doable via
  CreateAccount sponsoring without holding keys.

### Approach C — BYO wallet (Freighter / Albedo / WalletConnect)

Merchant connects an existing Stellar wallet. We never create
anything; we just store the address they provide and verify it has a
USDC trustline.

**Flow:**
1. Merchant signs up → dashboard says "Connect your Stellar wallet"
2. Modal lists Freighter, Albedo, LOBSTR, WalletConnect-for-Stellar
3. Merchant approves the connection → address returned
4. We check: does it exist? Does it have a USDC trustline?
5. If no trustline: prompt "Add USDC trustline" → user signs in wallet
6. Address saved → crypto pay enabled

**Pros:**
- True non-custodial.
- Zero reserve cost on us.
- Crypto-native merchants love it.

**Cons:**
- Requires the merchant to already have a Stellar wallet. Most
  small-business owners don't.
- High abandonment: "install Freighter, fund it with XLM, add a
  trustline" is the same six-step wall, just in pretty UI.
- Not the standard business onboarding shape — this is the
  developer-mode option.

---

## Recommendation: ship A, plan for A+B+C

**Short term (this week):** ship **Approach A** as the default.
Auto-provisioned Stellar settlement account at register time, seed
encrypted server-side, dashboard shows "Settlement: G…XXXX (managed by
Useroutr)" with a "Withdraw" button stubbed for later.

Why:
- Unblocks merchants in 1 day instead of 5.
- Zero merchant friction — matches Stripe's onboarding shape.
- The custodial gap is small (we hold seeds, but funds flow through
  briefly and the merchant always has a withdraw path).
- The marketing claim becomes "non-custodial settlement on the chain;
  the keys are managed by Useroutr for you, withdraw anytime" — not
  the strongest claim but defensible.

**Medium term (next month):** add **Approach B** as the upgrade path.
"Switch to passkey-managed wallet" button in settings. New merchants
opt in via a checkbox at signup ("manage my own keys"). Existing
merchants migrate their balance over.

**Long term (always available):** **Approach C** for crypto-native
merchants. "Connect existing wallet" link on the same settlement
settings page.

This stack lets us:
- Onboard non-crypto businesses today (A)
- Onboard crypto-native businesses today (C, if we wire it now)
- Migrate everyone to non-custodial later (B)
- And the marketing message evolves: "We auto-setup → you can switch to
  self-custody anytime" — that's the honest, business-friendly story.

---

## Approach A — concrete design

### Schema

```prisma
// New table — separate from Merchant so the encrypted seed is harder
// to leak via accidental SELECT * on the merchant table.
model MerchantSettlementKey {
  id              String   @id @default(cuid())
  merchantId      String   @unique
  stellarAddress  String   @unique
  // Encrypted seed. Encryption: AES-256-GCM keyed by a per-row IV +
  // KEK derived from SETTLEMENT_KEY_KEK env var. KEK rotation is
  // out-of-scope for v1 — single key, documented in runbook.
  encryptedSeed   String
  iv              String
  authTag         String
  /// Set when the merchant rotates to their own wallet (Approach B/C).
  rotatedAt       DateTime?
  /// Public-facing flag — UI shows "managed by Useroutr" vs
  /// "self-custody" based on this.
  managed         Boolean  @default(true)
  createdAt       DateTime @default(now())
  merchant        Merchant @relation(fields: [merchantId], references: [id])
}
```

`Merchant.settlementAddress` stays as-is; it mirrors
`MerchantSettlementKey.stellarAddress` so the rest of the codebase
doesn't need to change.

### Provisioning flow

A new service `MerchantSettlementService` exposes:

```ts
async provisionStellarAccount(merchantId: string): Promise<{ stellarAddress: string }>
```

Steps:

1. Generate a fresh Stellar Keypair (server-side, in-memory only).
2. **Testnet:** call Friendbot to fund it (10k XLM).
   **Mainnet:** build a sponsored CreateAccount op from our reserve
   wallet, sponsor 1 XLM + 0.5 XLM per trustline.
3. Add USDC trustline (signed by the new key).
4. Encrypt the seed with AES-256-GCM (KEK from env).
5. Insert `MerchantSettlementKey` row + update
   `Merchant.settlementAddress`.
6. Return the public address.

Triggered from:
- `AuthService.register` — after merchant row is created, before
  returning. Wrapped in try/catch — if Stellar is down, merchant
  still gets created and a background job retries provisioning.
  Dashboard shows a "Provisioning settlement…" banner until done.
- Manual retry endpoint: `POST /v1/merchants/me/settlement/provision`

### Cost model (mainnet)

| Cost item | XLM | USD (est. $0.10/XLM) |
|---|---|---|
| Account reserve | 1 XLM | $0.10 |
| USDC trustline reserve | 0.5 XLM | $0.05 |
| CreateAccount tx fee | ~0.00001 XLM | negligible |
| ChangeTrust tx fee | ~0.00001 XLM | negligible |
| **Total per merchant** | **~1.5 XLM** | **~$0.15** |

At 10k merchants: ~$1,500 in reserve outlay. Recoverable when
merchants close their account (reserves are returned). Acceptable.

### Withdrawal stub (UI placeholder, not implemented in v1)

Settings → Settlement section shows:
```
Settlement: G…ABCD (managed by Useroutr)
Balance: 124.50 USDC
                                            [Withdraw to my wallet]
```

The button opens a modal: "Enter your Stellar address to withdraw to."
Sends a path-payment from the managed account to the merchant's
address, signed server-side. Empties the managed balance.

This is the "honest custody" lever — when a merchant withdraws, we no
longer touch the funds. The vast majority of merchants will leave the
balance in the managed account between payouts; that's fine and is
what Stripe does too.

### Security model

- Seed encryption key (KEK) lives in `SETTLEMENT_KEY_KEK` env var.
  Production: rotated via a secrets manager (AWS KMS / GCP KMS / Vault).
- Decryption only ever happens in-memory during a sign operation.
  Seeds are never logged.
- Server compromise = seed compromise. Mitigations: minimal access
  scope, audit logs on every decrypt, KEK rotation procedure
  documented in runbook.
- Per-merchant rate limiting on withdrawal endpoints (3 withdrawals/
  hour by default) to slow down attacker exfiltration if a JWT leaks.

### What this PR does NOT do

- Doesn't implement withdrawal (UI button is a stub, the endpoint is
  added but returns 501 Not Implemented).
- Doesn't auto-migrate existing merchants. New table + provisioning
  applies to merchants registered after this PR ships. Existing
  merchants without a `settlementAddress` get the same UI prompt:
  "Click here to provision your settlement account."
- Doesn't ship Approach B or C. Those are explicit follow-up PRs.

---

## Implementation slicing

- **PR 7.9a** — schema + `MerchantSettlementService` + provision on
  register. ~1 day.
- **PR 7.9b** — dashboard surface (settings page, banner during
  provisioning, "managed by Useroutr" badge). ~0.5 day.
- **PR 7.9c** — manual retry endpoint + UI button for existing
  merchants. ~0.5 day.
- **PR 7.9d** — withdrawal endpoint + UI (separate decision: do we
  want this in v1 or v2?). 1+ day depending on scope.

PR 7.9a unblocks crypto pay immediately. PR 7.9b/c are polish. PR 7.9d
is the "honest custody" lever and can wait until first merchant asks.

---

## Sign-off checklist

- [ ] Founder agrees: **Approach A** as the default settlement
      onboarding (custodial, sponsored)
- [ ] Founder agrees: Approach B (passkey, non-custodial) is the
      medium-term upgrade path
- [ ] Founder agrees: Approach C (BYO wallet) is always available as
      an opt-in
- [ ] Founder agrees: marketing copy updates from "non-custodial by
      architecture" to "non-custodial settlement on the chain; managed
      keys with self-custody upgrade path" (or similar honest framing)
- [ ] Founder agrees: ~$0.15/merchant XLM reserve outlay on mainnet is
      acceptable; reserves recovered when merchants close accounts
- [ ] Founder agrees: testnet uses Friendbot (no cost); mainnet uses a
      dedicated Useroutr reserve wallet sponsoring CreateAccount ops
- [ ] Founder agrees: ship PR 7.9a + 7.9b in this slice; defer
      withdrawal (7.9d) to a separate PR triggered by first merchant
      ask
- [ ] Founder agrees: existing merchants without `settlementAddress`
      see a one-click "Provision settlement" button rather than being
      auto-migrated silently
- [ ] Founder confirms: `SETTLEMENT_KEY_KEK` env var is provisioned
      with a strong random value before this hits any environment
