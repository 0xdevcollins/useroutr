# Useroutr — Soroban Contracts

Rust/Soroban contracts for the Stellar settlement leg. See
[`docs/06-smart-contract-spec.md`](../../docs/06-smart-contract-spec.md) for the
design and invariants each contract is held to.

| Contract | Crate | Purpose | Env var |
| --- | --- | --- | --- |
| `escrow` | `contracts/escrow` | Holds a settled payment through a dispute window; arbiter can release, refund, or split | `SOROBAN_ESCROW_CONTRACT_ID` |
| `fee_collector` | `contracts/fee-collector` | Splits the protocol fee out of a gross amount at settlement | `SOROBAN_FEE_COLLECTOR_CONTRACT_ID` |

## Layout

```text
contract/soroban
├── contracts/
│   ├── escrow/            # lib.rs, test.rs, test_snapshots/
│   └── fee-collector/
├── scripts/
│   ├── deploy.sh          # build + deploy + initialize
│   ├── verify.sh          # confirm deployments are live and configured
│   └── lib.sh             # shared helpers + the contract manifest
├── deployments/           # <network>.json — deployed contract ids (committed)
├── Cargo.toml             # workspace
└── Cargo.lock             # committed; CI builds with --locked
```

## Develop

```bash
cargo test --workspace --locked
```

`cargo fmt --all` before pushing. CI pins rustc to **1.93.0** — a newer stable
rejects `ethnum 1.5.2` (transitive via `soroban-sdk`), so match that toolchain
locally if you hit `E0512`.

Build the wasm:

```bash
stellar contract build
```

## Deploy

Prerequisites: the [Stellar CLI](https://developers.stellar.org/docs/tools/cli)
and a funded account. For testnet, create and fund one with:

```bash
stellar keys generate deployer --network testnet --fund
```

That uses [Friendbot](https://friendbot.stellar.org); you can also fund an
existing `G…` address directly at <https://friendbot.stellar.org?addr=G…>.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SOROBAN_DEPLOY_SECRET` | yes | `S…` secret of the deploying account. Falls back to `STELLAR_SECRET_KEY`, then `STELLAR_RELAY_KEYPAIR_SECRET`. |
| `STELLAR_SOROBAN_RPC_URL` | mainnet only | RPC endpoint. Testnet defaults to `https://soroban-testnet.stellar.org`; there is no free public mainnet RPC, so name a provider. |
| `FEE_COLLECTOR_ADMIN` | yes | `G…` admin. Falls back to `STELLAR_RELAY_PUBLIC_KEY`. **Must be the deploying account** — the constructor calls `admin.require_auth()`. |
| `FEE_COLLECTOR_TREASURY` | yes | `G…` address that receives protocol fees. |
| `ESCROW_ADMIN` | yes | `G…` admin able to pause new locks. Defaults to `FEE_COLLECTOR_ADMIN`. |
| `FEE_BPS` | no | Protocol fee in bps. Default `50`, hard-capped at `200` by the contract. |
| `ENV_FILE` | no | Where contract ids are written. Defaults to the repo-root `.env`. |

### Run it

```bash
cd contract/soroban && ./scripts/deploy.sh testnet
```

That one command runs the test suite, builds the wasm, deploys every contract in
the manifest, writes each id into `.env`, and records them in
`deployments/testnet.json`.

Every contract is configured by its `__constructor`, which runs inside the
deploy transaction. There is no separate initialize step to run — and no window
in which someone else could run it first, which is what made the old
`initialize()` entry point front-runnable (#172). The constructor arguments
above are therefore required, not optional: the script checks them before it
spends anything, because a constructor argument cannot be supplied afterwards.

Options:

| Flag | Effect |
| --- | --- |
| `--yes` | Skip the mainnet confirmation prompt (CI uses this) |
| `--skip-build` | Reuse the wasm already in `target/` |
| `--skip-tests` | Do not run `cargo test` first |
| `--redeploy` | Deploy fresh instances even if ids are already recorded |

Re-running is safe by default: contracts with a recorded id are left alone.
Reconfiguring an existing deployment is not possible — configuration is fixed at
deploy time — so changing an admin or treasury means deploying a fresh instance
with `--redeploy`.

Mainnet asks you to type `mainnet` to confirm before spending anything:

```bash
STELLAR_SOROBAN_RPC_URL="https://your-provider.example" ./scripts/deploy.sh mainnet
```

### Verify

```bash
./scripts/verify.sh testnet
```

For each contract this checks that the id is set in `.env`, matches
`deployments/<network>.json`, resolves to a live (non-archived) contract, and
that the deployed wasm exposes the entry points we expect. For `fee_collector`
it also reads back `get_fee_bps` and checks it against the 200 bps cap; for
`escrow` it reads back the admin and whether the contract is paused. Exits
non-zero on any failure, so it can gate a pipeline.

### Adding a contract

Add the crate under `contracts/`, then add one line to `CONTRACTS` in
[`scripts/lib.sh`](scripts/lib.sh):

```bash
CONTRACTS=(
  "escrow:SOROBAN_ESCROW_CONTRACT_ID"
  "fee_collector:SOROBAN_FEE_COLLECTOR_CONTRACT_ID"
  "your_contract:SOROBAN_YOUR_CONTRACT_ID"      # <wasm stem>:<env var>
)
```

The wasm stem is the crate name with `-` replaced by `_`. Both scripts pick it
up from there; add its expected entry points to `expected_fns()` in
[`scripts/verify.sh`](scripts/verify.sh), and its constructor arguments to
`constructor_args()` and `required_admin_vars()` in
[`scripts/lib.sh`](scripts/lib.sh).

### CI

`.github/workflows/contracts.yml` (`workflow_dispatch` → "Deploy Contracts")
runs the same scripts, so CI and local deploys cannot drift. It needs the
`STELLAR_SECRET_KEY` secret and, for mainnet, `STELLAR_SOROBAN_RPC_URL`.
