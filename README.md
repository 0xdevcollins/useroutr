# Useroutr

Non-custodial, cross-chain payment infrastructure where payers can send from any supported chain and merchants receive on their preferred chain/asset, with Stellar as the settlement hub.

## Project Summary

Useroutr is built around **atomic HTLC settlement** across chains:

- **Inbound**: payer locks funds on source chain (EVM/Stellar/Starknet routes).
- **Routing**: Stellar path payment + Soroban contracts handle conversion and fee deduction.
- **Outbound**: funds are bridged/disbursed to merchant destination chain.
- **Guarantee**: either both sides complete or funds are refunded after timeout.

Core backend responsibilities (NestJS modular monolith in `apps/api`):

- Auth + merchants (JWT/API keys)
- Quotes (30s Redis TTL lock)
- Payments lifecycle + webhook events
- Bridge routing (CCTP, Wormhole, Layerswap)
- Relay service (HTLC event watching + secret propagation)
- Invoices, links, payouts, notifications, analytics

Smart contracts:

- Soroban contracts (`contract/soroban`): HTLC, settlement, fee collector, escrow
- EVM HTLC (`contract/evm/contracts/HTLCEvm.sol`)
- Starknet HTLC (`contract/starknet/src/htlc.cairo`)

## Repository Structure (current)

- `apps/api` — NestJS API + Prisma schema/migrations
- `packages/stellar` — shared Stellar clients/helpers
- `packages/types` — shared chain/payment types
- `contract/soroban` — Rust Soroban contracts
- `contract/evm` — Solidity HTLC + Hardhat config
- `contract/starknet` — Cairo HTLC

## How to Run Locally

### 1) Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose
- `openssl` (for secret generation)

Optional for contract work:

- Rust toolchain (`wasm32-unknown-unknown`)
- `stellar` CLI
- Hardhat-compatible wallet keys/testnet RPCs

### 2) Install dependencies

From repo root:

```bash
npm install
```

If API workspace deps are not installed from root in your environment:

```bash
cd apps/api
npm install
cd ../..
```

### 3) Configure environment

Create `.env` from `.env.example` at repo root:

```bash
cp .env.example .env
```

Important local DB note:

- `docker-compose.yml` maps Postgres to host port **5434** (`5434:5432`)
- so set `DATABASE_URL` to:

```env
DATABASE_URL="postgresql://tavvio:password@localhost:5434/tavvio"
```

Set at least these for local API startup:

- `DATABASE_URL`
- `REDIS_URL=redis://localhost:6379`
- `JWT_SECRET`

### 4) Start local infrastructure

```bash
docker compose up -d
docker compose ps
```

### 5) Run Prisma migrations

From `apps/api`:

```bash
npx prisma migrate dev
npx prisma generate
```

### 6) Start the API

From `apps/api`:

```bash
npm run start:dev
```

API runs on `http://localhost:3000` by default.

### Everything at once, in Docker

Steps 4–6 above start only Postgres and Redis and leave you to run each app by
hand. To bring up the whole stack instead:

```bash
cp .env.example .env && docker compose up
```

| Service | URL | Notes |
| --- | --- | --- |
| `api` | http://localhost:3000 | `/healthz` liveness, `/readyz` readiness; everything else under `/v1` |
| `dashboard` | http://localhost:3001 | |
| `www` | http://localhost:3002 | |
| `checkout` | http://localhost:3003 | |
| `postgres` | localhost:5434 | `tavvio/password`, volume `pgdata` |
| `redis` | localhost:6379 | volume `redisdata` |

The repo is bind-mounted into each app container, so edits on the host
hot-reload inside it. `node_modules` and `.next` are masked with anonymous
volumes — the host's `node_modules` is built for the host's platform and would
shadow the image's Linux binaries (Prisma engines, SWC).

`api` waits for Postgres and Redis to pass their healthchecks before starting;
the frontends wait for `api`. Migrations are not run automatically:

```bash
docker compose exec api npx --workspace=api prisma migrate dev
```

Useful:

```bash
docker compose up api            # just the API and its dependencies
docker compose logs -f api       # follow one service
docker compose build --no-cache  # after changing a Dockerfile or lockfile
docker compose down -v           # stop and wipe the database volume
```

Each app's `Dockerfile` also carries a `production` target (compose uses `dev`),
which builds the app and runs it without the source mount.

## Pre-Beta Environment Setup Guide

Before deploying to beta or production, ensure all required environment variables are properly configured. This section details all secrets, credentials, and their sources.

### Security Warnings

⚠️ **NEVER commit secrets to version control.** All `.env` files are gitignored by default.

⚠️ **Use `./scripts/generate-secrets.sh`** to generate cryptographically secure random values for JWT and encryption keys.

### Environment Variables by Category

#### 1. Core Infrastructure (Required)

These variables are required for the API to start:

| Variable | Description | Source | Example |
|----------|-------------|--------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Create a database and get the connection URL | `postgresql://tavvio:password@localhost:5434/tavvio` |
| `REDIS_URL` | Redis connection string | Redis instance (local or cloud) | `redis://localhost:6379` |
| `NODE_ENV` | Application environment | Set to `development`, `staging`, or `production` | `development` |
| `PORT` | API listen port | Choose any available port | `3000` |

**Setup for local development:**

```bash
docker compose up -d
# Database and Redis are now available
```

#### 2. Authentication & Security (Required)

Generate these using the provided script:

```bash
./scripts/generate-secrets.sh > secrets.txt
# Copy values from secrets.txt to .env
```

| Variable | Description | Length | Source |
|----------|-------------|--------|--------|
| `JWT_SECRET` | JWT signing key (HS256) | 64+ bytes (base64) | Run `./scripts/generate-secrets.sh` |
| `BANK_SESSION_ENCRYPTION_KEY` | AES-256 key for sensitive data | 32 bytes (base64) | Run `./scripts/generate-secrets.sh` |
| `BANK_WEBHOOK_SECRET` | Verify bank webhook integrity | 32+ bytes (base64) | Run `./scripts/generate-secrets.sh` |
| `JWT_EXPIRY` | JWT token expiration | N/A | Set to `7d` or preferred duration |

**Example setup:**

```bash
# Generate secrets
./scripts/generate-secrets.sh > .env.secrets

# Add to .env
cat .env.secrets >> .env
```

#### 3. Stellar Configuration (Required for Payments)

| Variable | Description | Source | Format |
|----------|-------------|--------|--------|
| `STELLAR_NETWORK` | Stellar environment | Set to `testnet` or `mainnet` | `testnet` |
| `STELLAR_HORIZON_URL` | Stellar HTTP API endpoint | Use public endpoints or self-hosted | `https://horizon-testnet.stellar.org` |
| `STELLAR_SOROBAN_RPC_URL` | Soroban RPC endpoint | Use public endpoints or self-hosted | `https://soroban-testnet.stellar.org` |
| `STELLAR_RELAY_KEYPAIR_SECRET` | Relay account signing key | Generate via `stellar key generate` | `SXXXXXX...` (starts with `S`) |
| `STELLAR_RELAY_PUBLIC_KEY` | Relay account public key | Derived from keypair | `GXXXXXX...` (starts with `G`) |

**Generate Stellar keys:**

```bash
# Install stellar CLI if needed
brew install stellar-cli

# Generate a new keypair
stellar key generate

# Output will show secret and public key
# IMPORTANT: Fund the account with testnet XLM at https://friendbot.stellar.org
```

**Deploy contracts:**

The Soroban contract IDs must be deployed and set in the environment:

| Variable | Description | Source |
|----------|-------------|--------|
| `SOROBAN_HTLC_CONTRACT_ID` | HTLC contract | Deploy `contract/soroban` and record the ID |
| `SOROBAN_SETTLEMENT_CONTRACT_ID` | Settlement contract | Deploy `contract/soroban` and record the ID |
| `SOROBAN_FEE_COLLECTOR_CONTRACT_ID` | Fee collector contract | Deploy `contract/soroban` and record the ID |
| `SOROBAN_ESCROW_CONTRACT_ID` | Escrow contract | Deploy `contract/soroban` and record the ID |

#### 4. EVM Configuration (Required for Multi-Chain Support)

| Variable | Description | Source | Format |
|----------|-------------|--------|--------|
| `EVM_RELAY_PRIVATE_KEY` | EVM relay account private key | Generate via MetaMask or ethers.js | `0xXXXX...` (0x-prefixed hex, 64 chars) |
| `RPC_ETHEREUM` | Ethereum RPC endpoint | Alchemy, Infura, or public endpoint | `https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY` |
| `RPC_BASE` | Base RPC endpoint | Alchemy, Infura, or public endpoint | `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY` |
| `RPC_BNB` | BNB Chain RPC endpoint | Binance public RPC | `https://bsc-dataseed.binance.org` |
| `RPC_POLYGON` | Polygon RPC endpoint | Polygon public RPC | `https://polygon-rpc.com` |
| `RPC_ARBITRUM` | Arbitrum RPC endpoint | Arbitrum public RPC | `https://arb1.arbitrum.io/rpc` |
| `RPC_AVALANCHE` | Avalanche C-Chain RPC endpoint | Avalanche public RPC | `https://api.avax.network/ext/bc/C/rpc` |

**Deploy HTLC contracts on each chain:**

| Variable | Description | Source |
|----------|-------------|--------|
| `HTLC_ADDRESS_ETHEREUM` | HTLC contract on Ethereum | Deploy `contract/evm` via Hardhat, record address |
| `HTLC_ADDRESS_BASE` | HTLC contract on Base | Deploy `contract/evm` via Hardhat, record address |
| `HTLC_ADDRESS_BNB` | HTLC contract on BNB Chain | Deploy `contract/evm` via Hardhat, record address |
| `HTLC_ADDRESS_POLYGON` | HTLC contract on Polygon | Deploy `contract/evm` via Hardhat, record address |
| `HTLC_ADDRESS_ARBITRUM` | HTLC contract on Arbitrum | Deploy `contract/evm` via Hardhat, record address |
| `HTLC_ADDRESS_AVALANCHE` | HTLC contract on Avalanche | Deploy `contract/evm` via Hardhat, record address |

**Generate an EVM private key:**

```bash
# Via ethers.js
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Private Key:', wallet.privateKey); console.log('Address:', wallet.address);"

# Or import MetaMask: Export → Private Key (⚠️ keep secure)
```

#### 5. Bridge Integrations (Optional but Recommended for Beta)

| Variable | Description | Source | When Required |
|----------|-------------|--------|----------------|
| `CIRCLE_API_KEY` | Circle CCTP API key | [Circle Developer Portal](https://developers.circle.com) | For stablecoin bridging |
| `WORMHOLE_ENV` | Wormhole environment | Set to `Testnet` or `Mainnet` | For cross-chain messaging |
| `LAYERSWAP_API_KEY` | Layerswap API key | [Layerswap Dashboard](https://www.layerswap.io) | For Starknet routing |

#### 6. Stripe Integration (Optional but Recommended for Beta)

| Variable | Description | Source | Format |
|----------|-------------|--------|--------|
| `STRIPE_SECRET_KEY` | Stripe secret API key | [Stripe Dashboard](https://dashboard.stripe.com) | `sk_test_...` (test) or `sk_live_...` (production) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe → Webhooks → Signing secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (public) | [Stripe Dashboard](https://dashboard.stripe.com) | `pk_test_...` (test) or `pk_live_...` (production) |

**Setup:**

1. Create a Stripe account
2. Get API keys from Dashboard → API Keys
3. Create a webhook endpoint pointing to `https://api.yourdomain.com/v1/webhooks/stripe`
4. Copy the webhook signing secret

#### 7. Email Service (Optional but Recommended for Beta)

| Variable | Description | Source |
|----------|-------------|--------|
| `RESEND_API_KEY` | Resend email service API key | [Resend Dashboard](https://resend.com) |
| `EMAIL_FROM` | From address for notifications | Your verified sender address | `payments@useroutr.com` |

#### 8. Media Storage (Optional)

| Variable | Description | Source |
|----------|-------------|--------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [Cloudinary Dashboard](https://cloudinary.com) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary Settings → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary Settings → API Keys (keep secure) |

#### 9. URLs & Application Config (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `API_URL` | Public API URL | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Frontend API endpoint | `https://api.yourdomain.com` or `http://localhost:3000` |
| `WWW_URL` | Main website URL | `https://useroutr.com` or `http://localhost:3000` |
| `DASHBOARD_URL` | Dashboard URL | `https://dashboard.useroutr.com` or `http://localhost:3001` |
| `CHECKOUT_URL` | Checkout widget URL | `https://checkout.useroutr.com` or `http://localhost:3002` |
| `USEROUTR_FEE_BPS` | Platform fee in basis points | `50` (0.5%) |

#### 10. MoneyGram Integration (Optional)

| Variable | Description | Source | Environment |
|----------|-------------|--------|-------------|
| `MONEYGRAM_HOME_DOMAIN` | MoneyGram federation domain | MoneyGram Developer Portal | Testnet: `extstellar.moneygram.com` / Mainnet: `stellar.moneygram.com` |

### Environment Setup by Stage

#### Local Development

Minimum required for `npm run start:dev`:

```env
DATABASE_URL=postgresql://tavvio:password@localhost:5434/tavvio
REDIS_URL=redis://localhost:6379
JWT_SECRET=<run: ./scripts/generate-secrets.sh>
NODE_ENV=development
PORT=3000
# STELLAR_RELAY_KEYPAIR_SECRET and EVM_RELAY_PRIVATE_KEY are only required
# when NODE_ENV=production; payment signing features need them at runtime.
```

#### Beta / Staging

Add all bridge and payment service integrations:

- All Core Infrastructure variables
- All Authentication variables
- All Stellar variables (with testnet endpoints)
- All EVM variables (with testnet RPCs)
- Circle, Wormhole, Layerswap credentials
- Stripe test keys
- Resend API key
- All URLs pointing to staging domain

#### Production

⚠️ **Do not proceed until:**
- [ ] Smart contracts have been audited
- [ ] All private keys are stored in a secure key management system (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Rate limiting and DDoS protection are configured
- [ ] Monitoring and alerting are in place
- [ ] Disaster recovery plan is documented

Production variables:

- All Core Infrastructure variables (using production database and Redis)
- All Authentication variables (regenerated and stored securely)
- All Stellar variables (mainnet endpoints)
- All EVM variables (mainnet RPCs, deployed contracts)
- All third-party service keys (production credentials)
- Production URLs and domains

### Validation

The API automatically validates critical environment variables on startup. If any required variable is missing or contains a placeholder value, the API will fail to start with a clear error message.

Example error:

```
❌ Environment Configuration Errors:

STARTUP FAILED: STELLAR_RELAY_KEYPAIR_SECRET is a placeholder or missing. Set a valid value.
STARTUP FAILED: JWT_SECRET is a placeholder or missing. Set a valid value.

📋 To generate secrets, run: ./scripts/generate-secrets.sh
```

### Troubleshooting

**Issue:** API fails to start with "JWT_SECRET is a placeholder"

**Solution:**
```bash
./scripts/generate-secrets.sh > .env.secrets
# Copy values to .env, ensure no placeholder patterns like "your-secret" remain
```

**Issue:** "STELLAR_RELAY_KEYPAIR_SECRET not set"

**Solution:**
```bash
stellar key generate
# Fund the account: https://friendbot.stellar.org/?addr=GXXXXXX
# Add secret to .env
```

**Issue:** "DATABASE_URL connection failed"

**Solution:**
```bash
docker compose up -d  # Ensure Postgres is running
docker compose logs postgres  # Check for errors
```

## Useful Commands

From `apps/api`:

```bash
npm run test
npm run test:e2e
npm run build
```

Soroban contracts:

```bash
cd contract/soroban
cargo test
```

EVM contracts:

```bash
cd contract/evm
npm install
npx hardhat test
```

## Notes

- Production deployment requires contract audits, strict key management, and chain-specific bridge credentials.
