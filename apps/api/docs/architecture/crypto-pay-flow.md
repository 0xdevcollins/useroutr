# Customer crypto pay flow (CCTP V2)

**Status:** Plan for sign-off — no code has landed.
**Owner:** Backend team + checkout app. Sign off here before PR 7.8a opens.
**Scope:** EVM → Stellar, USDC only, Fast Transfer, testnet first.

This is the design artifact for the customer-facing crypto pay flow. PR 7
established the link → method picker → method-specific session pattern.
PR 7.7 made card + bank work by auto-filling source fields. This doc
covers the crypto leg, which is genuinely different — it requires a
quote, a wallet signature, and an async wait for Circle's attestation.

Implementation lands in three PRs once this is signed off:

- **PR 7.8a — API endpoints + state machine** (~1.5h)
- **PR 7.8b — BullMQ worker for CCTP attestation** (~1h)
- **PR 7.8c — Frontend rewrite of `CryptoPayment.tsx`** (~2h)

---

## State machine

Payment row through the crypto leg, mapped to existing `PaymentStatus`
enum values (no schema change):

```
PENDING                       ← createFromLink (no source, no quote)
   │
   │ customer picks "Crypto" → picks source chain
   │ POST /v1/checkout/:id/select-crypto { sourceChain }
   ▼
QUOTE_LOCKED                  ← Quote row created (TTL 30s)
   │                           Payment patched: sourceChain, sourceAsset='USDC',
   │                           sourceAmount=quote.fromAmount, quoteId
   │
   │ customer signs approve(USDC, TokenMessengerV2, amount)
   │ customer signs depositForBurnWithHook(...)
   │ POST /v1/checkout/:id/burn-submitted { sourceTxHash }
   ▼
SOURCE_LOCKED                 ← sourceTxHash recorded
   │                           BullMQ job `cctp.observe` enqueued
   │
   │ worker parses burn receipt (extracts nonce + amount + recipient)
   │ worker polls Iris for attestation (~8-20s Fast Transfer)
   ▼
PROCESSING                    ← attestation complete (cctpNonce + cctpAttestation set)
   │                           forwardTxHash recorded if Forwarding Service relayed
   │
   │ Stellar mint confirms (Forwarding Service handles broadcast)
   │ worker observes destTxHash, marks payment COMPLETED
   ▼
COMPLETED                     ← destTxHash recorded
                              webhook fired
                              customer page redirects to /:id/success
```

Failure exits:
- `select-crypto` → no state change, error surfaces inline
- `burn-submitted` rejected (wrong status) → 409, stays in QUOTE_LOCKED
- Attestation times out (>15 min) → status=FAILED, customer can recreate quote and retry
- Mint reverts on Stellar → status=FAILED, refund flow (out of scope for v1)

---

## Endpoints (all on `CheckoutPaymentsController`, all public, no auth)

### `POST /v1/checkout/:paymentId/select-crypto`

Pick a source chain and lock a quote. Public — `:paymentId` is the
credential (it's a cuid the customer received from the from-link flow).

**Body**

```json
{ "sourceChain": "base" }
```

`sourceChain` must be one of the **enabled** CCTP V2 EVM domains:
`ethereum`, `avalanche`, `optimism`, `arbitrum`, `base`. The
`enabledDomains()` helper in `cctp/domains.ts` is the source of truth.

**Behaviour**

1. Validate `sourceChain` is enabled and EVM-kind
2. Validate `payment.status === 'PENDING'` (idempotent: if already
   QUOTE_LOCKED with the same sourceChain, return the existing quote)
3. Fetch payment + merchant
4. Validate merchant has a Stellar settlement address (G…) — if not,
   `502 Bad Gateway` with `"Merchant has not configured a Stellar settlement address"` (operational error, not customer-facing)
5. Internal call to `QuotesService.createQuote({ fromChain, fromAsset:'USDC', fromAmount: payment.destAmount.toString() })` with the payment's merchantId
6. Patch Payment row: `sourceChain`, `sourceAsset='USDC'`, `sourceAmount=quote.fromAmount`, `quoteId`, `status='QUOTE_LOCKED'`
7. Build the CCTP burn payload via `CctpService.prepareBurn({ fromChain, toChain:'stellar', amount: parseUnits(quote.fromAmount, 6), recipient: merchant.settlementAddress, speed:'fast', mintMode:'forwarder', maxFee:0n })`
8. Return the locked quote + the wallet-signable payload

**Response (200)**

```json
{
  "quote": {
    "id": "quo_…",
    "fromAmount": "25.0",
    "fromAsset": "USDC",
    "fromChain": "base",
    "toAmount": "24.875",
    "toAsset": "USDC",
    "toChain": "stellar",
    "rate": "1.0",
    "fee": "0.125",
    "feeBps": 50,
    "expiresAt": "2026-05-24T22:00:00Z",
    "expiresInSeconds": 30
  },
  "wallet": {
    "chainId": 84532,
    "approve": {
      "to": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",   // USDC on Base Sepolia
      "abi": "erc20.approve",
      "args": [
        "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",        // TokenMessengerV2 spender
        "25000000"                                             // amount in 6dp
      ]
    },
    "burn": {
      "to": "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",     // TokenMessengerV2
      "abi": "cctp.depositForBurnWithHook",
      "args": {
        "amount": "25000000",
        "destinationDomain": 27,
        "mintRecipient": "0x00…<merchant Stellar strkey in bytes32>",
        "burnToken": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "destinationCaller": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "maxFee": "0",
        "minFinalityThreshold": 500,
        "hookData": "0x…<encoded forwarder hook>"
      }
    }
  }
}
```

The frontend uses this verbatim — chainId tells wagmi to switch
networks if needed; `approve` and `burn` are sequential wallet
operations using `useWriteContract` with the embedded ABI fragment.

### `POST /v1/checkout/:paymentId/burn-submitted`

Notify the API that the customer signed and broadcast the burn.

**Body**

```json
{ "sourceTxHash": "0x…" }
```

**Behaviour**

1. Validate `payment.status === 'QUOTE_LOCKED'` (idempotent: if already
   SOURCE_LOCKED with the same tx hash, return existing state)
2. Validate quote hasn't expired (within 60s slack — stablecoin
   rate doesn't move, accept slightly late burns)
3. Patch Payment: `sourceTxHash`, `status='SOURCE_LOCKED'`
4. Enqueue BullMQ job `cctp.observe` with payload `{ paymentId, sourceTxHash, sourceChain }`
5. Return current status

**Response (202 Accepted)**

```json
{
  "status": "SOURCE_LOCKED",
  "sourceTxHash": "0x…",
  "estimatedSettlementMs": 12000,
  "next": "poll /v1/checkout/:paymentId/crypto-status every 3s"
}
```

### `GET /v1/checkout/:paymentId/crypto-status`

Poll-able status surface for the frontend. Returns the minimum the
checkout page needs to drive its UI between SOURCE_LOCKED → COMPLETED.

**Response (200)**

```json
{
  "status": "PROCESSING",
  "sourceTxHash": "0x…",
  "sourceExplorerUrl": "https://sepolia.basescan.org/tx/0x…",
  "attestation": {
    "status": "complete",
    "fetchedAt": "2026-05-24T22:00:09Z"
  },
  "destTxHash": null,
  "destExplorerUrl": null
}
```

Status field uses the same `PaymentStatus` enum as the rest of the
system — `SOURCE_LOCKED`, `PROCESSING`, `COMPLETED`, `FAILED`.

Frontend polls every 3s while status is `SOURCE_LOCKED` or
`PROCESSING`; stops polling on `COMPLETED` (redirect) or `FAILED`
(show error).

---

## BullMQ worker

New file: `apps/api/src/modules/cctp/cctp.processor.ts`.

**Queue**: `cctp.observe` (registered in `cctp.module.ts` via
`BullModule.registerQueue`).

**Job payload**

```ts
interface CctpObserveJob {
  paymentId: string;
  sourceTxHash: string;
  sourceChain: string;  // e.g. 'base'
}
```

**Behaviour**

```ts
@Process('cctp.observe')
async observe(job: Job<CctpObserveJob>): Promise<void> {
  const { paymentId, sourceTxHash, sourceChain } = job.data;

  try {
    // 1. observe() polls Iris + waits for attestation (~8-20s Fast)
    const record = await this.cctp.observe(sourceTxHash, sourceChain);

    // 2. Patch payment with attestation info + transition to PROCESSING
    await this.payments.updateStatus(paymentId, 'PROCESSING', {
      cctpNonce: record.burn.nonce.toString(),
      cctpAttestation: record.attestation.attestation ?? null,
    });

    // 3. If Forwarding Service has already broadcast the mint, it shows
    //    up as record.mintTxHash. That's our COMPLETE signal.
    if (record.mintTxHash) {
      await this.payments.updateStatus(paymentId, 'COMPLETED', {
        destTxHash: record.mintTxHash,
      });
    } else {
      // Self-relay path — not in scope for v1, but log so we notice.
      this.logger.warn(`No forwardTxHash on attestation for ${paymentId} — self-relay not implemented`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await this.payments.updateStatus(paymentId, 'FAILED', {
      metadata: {
        cctpError: message,
        failedAt: new Date().toISOString(),
      },
    });
    throw err;  // BullMQ records the failure
  }
}
```

**Retry policy**

- 3 attempts with exponential backoff (5s → 30s → 2min)
- The attestation poller inside `CctpService.observe()` already retries
  internally with its own backoff (per PR B), so a job-level retry is
  the outer safety net for transient RPC failures, not for Iris itself.

---

## Frontend rewrite

`apps/checkout/components/CryptoPayment.tsx` — complete rewrite. Drop
the HTLC code, drop USDT and native-token tabs, drop the hardcoded
addresses, drop the `useQuote` hook (replaced by select-crypto).

### Component states

| Status | UI |
|---|---|
| `PENDING` | Chain picker grid (5 enabled EVM chains). "Lock quote" CTA. |
| `QUOTE_LOCKED` | Quote card (you pay X USDC on Base, merchant receives Y on Stellar) + 30s countdown + "Approve & Pay" CTA + change-chain link |
| `SOURCE_LOCKED` | Spinner "Confirming on-chain…" + link to source explorer |
| `PROCESSING` | Spinner "Bridging via CCTP V2…" + "Settling on Stellar in ~10s" copy + source explorer link |
| `COMPLETED` | `router.replace('/[paymentId]/success')` |
| `FAILED` | Error card + "Try again" CTA (returns to PENDING after backend reset — out of v1, force-refresh for now) |

### Wallet ops (wagmi v2 + viem)

```ts
// 1. Wallet connected? If not, RainbowKit modal
const { isConnected } = useAccount();

// 2. On chain switch
const { switchChainAsync } = useSwitchChain();
await switchChainAsync({ chainId: wallet.chainId });

// 3. Approve (sequential)
const approveHash = await writeContractAsync({
  address: wallet.approve.to,
  abi: erc20Abi,
  functionName: 'approve',
  args: wallet.approve.args,
});
await waitForTransactionReceipt({ hash: approveHash });

// 4. Burn
const burnHash = await writeContractAsync({
  address: wallet.burn.to,
  abi: tokenMessengerV2Abi,
  functionName: 'depositForBurnWithHook',
  args: wallet.burn.args,
});
await waitForTransactionReceipt({ hash: burnHash });

// 5. Notify backend → start polling
await api.post(`/v1/checkout/${paymentId}/burn-submitted`, {
  sourceTxHash: burnHash,
});
```

Combined approve+burn into a single wallet flow with two prompts — no
multicall in v1, since not every wallet supports it cleanly. Cleaner
UX (multicall) can land later.

### Status polling

```ts
const { data: status } = useQuery({
  queryKey: ['crypto-status', paymentId],
  queryFn: () => api.get(`/v1/checkout/${paymentId}/crypto-status`),
  refetchInterval: (data) =>
    data?.status === 'COMPLETED' || data?.status === 'FAILED' ? false : 3000,
});
```

---

## ABI choices

**USDC `approve(spender, amount)`** — standard ERC-20, address per chain
from `contracts.ts` `EVM_CCTP[env].usdc`.

**`TokenMessengerV2.depositForBurnWithHook`** — full signature:

```solidity
function depositForBurnWithHook(
    uint256 amount,
    uint32 destinationDomain,
    bytes32 mintRecipient,
    address burnToken,
    bytes32 destinationCaller,
    uint256 maxFee,
    uint32 minFinalityThreshold,
    bytes calldata hookData
) external returns (uint64 nonce);
```

Args we pass:
- `amount`: quote.fromAmount × 10⁶ (USDC 6 decimals)
- `destinationDomain`: 27 (Stellar, from `domains.ts`)
- `mintRecipient`: Stellar G… address as bytes32 (right-padded; encoder
  is `Address.toBuffer()` from `@stellar/stellar-sdk` then padded)
- `burnToken`: USDC contract on the source chain
- `destinationCaller`: 32 zero bytes (any relayer, i.e. Circle's
  Forwarding Service)
- `maxFee`: 0 (Fast Transfer fee is paid out of the destination
  amount via the protocol's own bookkeeping; the customer's `amount`
  is exactly what they want to send)
- `minFinalityThreshold`: 500 (Fast Transfer — Standard is 1000)
- `hookData`: bytes built by `ForwarderService.buildHookData()`. Encodes
  the destination forwarder address + the Stellar mint recipient strkey.
  Already implemented; the new endpoint just calls into it.

`CctpService.prepareBurn` already returns the right calldata shape —
the new endpoint just unpacks it into the response above.

---

## Testnet setup (one-time, before first end-to-end test)

### Source side (customer)

1. Install MetaMask, switch to Base Sepolia network
   - RPC: `https://sepolia.base.org` (or Alchemy)
   - ChainId: 84532
   - Explorer: `https://sepolia.basescan.org`
2. Get test ETH: <https://www.alchemy.com/faucets/base-sepolia>
3. Get test USDC: <https://faucet.circle.com/> (pick Base Sepolia, paste wallet)

### Destination side (merchant)

1. Create a Stellar testnet keypair: <https://laboratory.stellar.org/#account-creator?network=test>
2. Fund it via Friendbot (button on the same page)
3. Add a USDC trustline on testnet (use the Stellar Lab `change trust` op pointing at the testnet USDC asset)
4. Save the G… address → PATCH `/v1/merchants/me/settlement` with `{ settlementAddress, settlementChain:'stellar', settlementAsset:'USDC' }`

### API config

`.env` already has the right defaults from PR A:
- `STELLAR_NETWORK=testnet` → drives Iris sandbox + Soroban testnet
- `CCTP_USE_FORWARDING=true` → Circle pays destination gas
- `CCTP_DEFAULT_SPEED=fast`

No new env vars introduced by this PR.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Customer closes tab after signing burn | Worker keeps polling regardless. Webhook fires when COMPLETED so merchant is still notified. Customer can return to `/{paymentId}` any time and see status — page rehydrates from `/crypto-status`. |
| Quote expires while customer is approving (slow wallet sign) | 60s slack window on `burn-submitted` — stablecoin rate doesn't move, accept slightly late. If wildly late (>5min), reject and ask for re-quote. |
| Attestation times out >15 min | Worker fails the job after 3 attempts. Status=FAILED with `cctpError` in metadata. Customer sees retry CTA. Manual recovery: re-quote with same paymentId. |
| Customer signs but burn never confirms (gas underestimate, mempool drop) | We get no `sourceTxHash` from burn-submitted (customer's wallet doesn't return). Stays in QUOTE_LOCKED, eventually EXPIRED by the existing pending-monitor job. |
| Multiple burns for one payment | `burn-submitted` is idempotent on `(paymentId, sourceTxHash)`. If a customer somehow signs twice with different tx hashes, only the first is enqueued. (Customer would still see USDC burned twice — they can dispute and get a refund; rare, low-priority.) |
| Stellar address not funded with trustline | Forwarder Service mint reverts at destination. Worker catches, status=FAILED with clear error. Operational alert: merchant must set up the trustline before going live. |
| Hook data encoding bug → mint goes to wrong account | The hook data construction has property tests in PR B. Round-trip test ensures encode(strkey) → decode == strkey. |
| Customer wallet on wrong chain | Frontend uses `useSwitchChain` automatically; manual confirm in MetaMask. |

---

## Out of scope (v1)

- **Stellar → EVM** — customer holds USDC on Stellar, wants to pay an EVM-settled merchant. Less common Tavvio flow; phase 2.
- **Non-USDC source** — committed in PR A.
- **Mainnet** — testnet smoke first, then mainnet enable per chain after observed reliability.
- **Self-relay fallback** — Forwarding Service exclusively (PR A sign-off). If Circle's relay goes down, status=FAILED and customer retries when they recover.
- **Standard Transfer (~15 min)** — only Fast in v1; customer waits in-page so 15 min is unacceptable UX. Standard becomes a per-quote option in phase 2 for institutional use.
- **Multicall (approve + burn in one click)** — wallet support varies; cleaner UX but two-prompt is acceptable for v1.
- **Refunds on FAILED** — merchant operates the refund out-of-band; manual for v1.

---

## Sign-off checklist

- [ ] Founder agrees: EVM → Stellar only in v1
- [ ] Founder agrees: USDC only, Fast Transfer only
- [ ] Founder agrees: testnet first (Base Sepolia primary), mainnet per-chain after smoke
- [ ] Founder agrees: 30s quote lock + 60s slack on burn submission
- [ ] Founder agrees: two-prompt wallet flow (approve, then burn) — no multicall in v1
- [ ] Founder agrees: payment status enum is the single source of truth, no separate event surface
- [ ] Founder agrees: the test merchant must have a real Stellar testnet address + USDC trustline before clicking Pay
- [ ] Founder confirms: BETTERSTACK_API_KEY is set (already noted in earlier sign-offs)
- [ ] Founder confirms: customer-side prereqs (MetaMask + faucet USDC + faucet ETH) are acceptable for v1; we don't auto-help the customer through them

Once all nine boxes are ticked, PR 7.8a opens.

---

## What this doesn't say

This doc covers the **mechanics** of the customer crypto pay flow. It
does NOT cover:

- **Marketing copy** for the crypto checkout page (which networks we
  advertise, "Powered by Circle CCTP V2" wording — covered in PR F).
- **Webhook event names** for `payment.completed` / `payment.failed`
  when the source is crypto (already standardized in the webhooks
  module).
- **Analytics events** (covered by the product-tracking plugin in a
  separate session).
- **Dashboard surfacing** of crypto payment failures (PR 9 territory).
