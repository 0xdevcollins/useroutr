#!/usr/bin/env bash
#
# Build, deploy and initialize every Soroban contract in the workspace.
#
#   ./scripts/deploy.sh [testnet|mainnet] [options]
#
#   --yes           skip the mainnet confirmation prompt
#   --skip-build    reuse the wasm already in target/
#   --skip-tests    do not run cargo test first
#   --redeploy      deploy fresh instances even if ids are already recorded
#   --reinitialize  re-run initialization against an existing deployment
#
# Contract ids are written to the repo-root .env (override with ENV_FILE) and
# recorded in deployments/<network>.json. Re-running is safe: already-deployed
# contracts are skipped unless --redeploy is passed.
#
# Required:
#   SOROBAN_DEPLOY_SECRET   S… secret key funding the deploy
#                           (falls back to STELLAR_SECRET_KEY, then
#                            STELLAR_RELAY_KEYPAIR_SECRET)
# Required on mainnet:
#   STELLAR_SOROBAN_RPC_URL RPC provider endpoint
# fee_collector initialization:
#   FEE_COLLECTOR_ADMIN     G… admin (falls back to STELLAR_RELAY_PUBLIC_KEY).
#                           `initialize` calls admin.require_auth(), so the
#                           admin must be the deploying account.
#   FEE_COLLECTOR_TREASURY  G… treasury address
#   FEE_BPS                 protocol fee in bps (default 50, max 200)
# settlement initialization:
#   SETTLEMENT_ADMIN        G… admin (defaults to FEE_COLLECTOR_ADMIN)
# escrow initialization:
#   ESCROW_ADMIN            G… admin able to pause new locks
#                           (defaults to FEE_COLLECTOR_ADMIN)

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

NETWORK_ARG="testnet"
ASSUME_YES=0
SKIP_BUILD=0
SKIP_TESTS=0
REDEPLOY=0
REINITIALIZE=0

while [ $# -gt 0 ]; do
  case "$1" in
    testnet | mainnet | public) NETWORK_ARG="$1" ;;
    -y | --yes) ASSUME_YES=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --redeploy) REDEPLOY=1 ;;
    --reinitialize) REINITIALIZE=1 ;;
    -h | --help) sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "unknown argument '$1' (try --help)" ;;
  esac
  shift
done

resolve_network "$NETWORK_ARG"

require_cmd stellar "https://developers.stellar.org/docs/tools/cli"
require_cmd cargo "https://rustup.rs"

DEPLOY_SECRET="${SOROBAN_DEPLOY_SECRET:-${STELLAR_SECRET_KEY:-${STELLAR_RELAY_KEYPAIR_SECRET:-}}}"
[ -n "$DEPLOY_SECRET" ] ||
  fail "set SOROBAN_DEPLOY_SECRET to the deploying account's secret key"

# Hand the key to the CLI through its own env var rather than `--source-account`.
# Command-line arguments are readable by any other process on the host via
# /proc/<pid>/cmdline; the environment of a process is not.
export STELLAR_ACCOUNT="$DEPLOY_SECRET"

info "Deploying Soroban contracts → ${NETWORK}"
step "rpc      $RPC_URL"
step "env file $(env_file)"
step "record   $(deployment_file)"

# Deploying to mainnet spends real XLM and publishes immutable contracts, so it
# takes an explicit confirmation unless the caller opted out (CI passes --yes).
if [ "$NETWORK" = "mainnet" ] && [ "$ASSUME_YES" -eq 0 ]; then
  printf '\n%s' "${C_YELLOW}This deploys to MAINNET. Type 'mainnet' to continue: ${C_RESET}"
  read -r confirmation
  [ "$confirmation" = "mainnet" ] || fail "aborted"
fi

cd "$SOROBAN_DIR"

if [ "$SKIP_TESTS" -eq 0 ]; then
  info "Running tests"
  cargo test --workspace --locked --quiet
  ok "tests pass"
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  info "Building wasm"
  stellar contract build --quiet
  ok "built"
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
info "Deploying"

declare -a DEPLOYED_NAMES=()
declare -a DEPLOYED_IDS=()
declare -a FRESHLY_DEPLOYED=()

for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  env_var="${entry##*:}"
  wasm="$(find_wasm "$name")"

  [ -n "$wasm" ] || fail "$name.wasm not found — run without --skip-build"

  existing="$(lookup_contract_id "$env_var" "$name")"
  if [ -n "$existing" ] && [ "$existing" != "C..." ] && [ "$REDEPLOY" -eq 0 ]; then
    ok "$name already deployed at $existing (--redeploy to replace)"
    DEPLOYED_NAMES+=("$name")
    DEPLOYED_IDS+=("$existing")
    continue
  fi

  step "deploying $name…"
  # The id is the last line of stdout; `set -o pipefail` still surfaces a
  # failed deploy through the pipe.
  contract_id="$(stellar contract deploy \
    --wasm "$wasm" \
    "${NETWORK_ARGS[@]}" \
    --quiet | tail -n 1)"

  [ -n "$contract_id" ] || fail "$name deploy returned no contract id"

  upsert_env_var "$env_var" "$contract_id"
  ok "$name → $contract_id"
  step "wrote $env_var to $(env_file)"

  DEPLOYED_NAMES+=("$name")
  DEPLOYED_IDS+=("$contract_id")
  FRESHLY_DEPLOYED+=("$name")
done

was_freshly_deployed() {
  local candidate="$1" n
  for n in ${FRESHLY_DEPLOYED[@]+"${FRESHLY_DEPLOYED[@]}"}; do
    [ "$n" = "$candidate" ] && return 0
  done
  return 1
}

# ── Record ───────────────────────────────────────────────────────────────────
mkdir -p "$DEPLOYMENTS_DIR"
{
  printf '{\n'
  printf '  "network": "%s",\n' "$NETWORK"
  printf '  "deployedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "contracts": {\n'
  for i in "${!DEPLOYED_NAMES[@]}"; do
    sep=","
    [ "$i" -eq $((${#DEPLOYED_NAMES[@]} - 1)) ] && sep=""
    printf '    "%s": "%s"%s\n' "${DEPLOYED_NAMES[$i]}" "${DEPLOYED_IDS[$i]}" "$sep"
  done
  printf '  }\n}\n'
} >"$(deployment_file)"
ok "recorded ${#DEPLOYED_NAMES[@]} contract id(s) in ${DEPLOYMENTS_DIR#"$REPO_ROOT"/}/$NETWORK.json"

# ── Initialize ───────────────────────────────────────────────────────────────
# Every contract rejects a second `initialize` with
# AlreadyInitialized, so re-running is safe but noisy; initialization is
# attempted only for contracts this run actually deployed, unless the caller
# passes --reinitialize (which will surface the contract's own error if the
# instance was already configured).
#
# `escrow` MUST be initialized: it refuses to lock funds without an admin, so
# that an incident always has someone able to pause new locks.
info "Initializing"

admin="${FEE_COLLECTOR_ADMIN:-${STELLAR_RELAY_PUBLIC_KEY:-}}"
treasury="${FEE_COLLECTOR_TREASURY:-}"
fee_bps="${FEE_BPS:-50}"

# should_initialize <name> <id> — echoes nothing, returns 0 when the caller
# should run this contract's initializer.
should_initialize() {
  local name="$1" id="$2"
  if [ -z "$id" ]; then
    warn "$name not deployed — skipping initialization"
    return 1
  fi
  if ! was_freshly_deployed "$name" && [ "$REINITIALIZE" -eq 0 ]; then
    ok "$name already deployed — leaving its config alone (--reinitialize to overwrite)"
    return 1
  fi
  return 0
}

fee_collector_id="$(lookup_contract_id SOROBAN_FEE_COLLECTOR_CONTRACT_ID fee_collector)"
if should_initialize fee_collector "$fee_collector_id"; then
  if [ -z "$admin" ] || [ -z "$treasury" ]; then
    warn "set FEE_COLLECTOR_ADMIN and FEE_COLLECTOR_TREASURY to initialize fee_collector"
    warn "deploy is complete, but fee_collector is unconfigured"
  else
    step "initializing fee_collector (fee_bps=$fee_bps)…"
    stellar contract invoke \
      --id "$fee_collector_id" \
      "${NETWORK_ARGS[@]}" \
      --quiet \
      -- initialize \
      --admin "$admin" \
      --fee_bps "$fee_bps" \
      --treasury "$treasury" >/dev/null ||
      fail "fee_collector initialize failed — the deploying account must be able to sign as admin ($admin)"
    ok "fee_collector initialized"
  fi
fi

escrow_id="$(lookup_contract_id SOROBAN_ESCROW_CONTRACT_ID escrow)"
escrow_admin="${ESCROW_ADMIN:-$admin}"
if should_initialize escrow "$escrow_id"; then
  if [ -z "$escrow_admin" ]; then
    warn "set ESCROW_ADMIN (or FEE_COLLECTOR_ADMIN) to initialize escrow"
    warn "escrow will REJECT every lock until it is initialized"
  else
    step "initializing escrow…"
    stellar contract invoke \
      --id "$escrow_id" \
      "${NETWORK_ARGS[@]}" \
      --quiet \
      -- initialize \
      --admin "$escrow_admin" >/dev/null ||
      fail "escrow initialize failed — the deploying account must be able to sign as admin ($escrow_admin)"
    ok "escrow initialized"
  fi
fi

settlement_id="$(lookup_contract_id SOROBAN_SETTLEMENT_CONTRACT_ID settlement)"
settlement_admin="${SETTLEMENT_ADMIN:-$admin}"
if should_initialize settlement "$settlement_id"; then
  if [ -z "$settlement_admin" ]; then
    warn "set SETTLEMENT_ADMIN (or FEE_COLLECTOR_ADMIN) to initialize settlement"
    warn "deploy is complete, but settlement is unconfigured"
  else
    step "initializing settlement…"
    stellar contract invoke \
      --id "$settlement_id" \
      "${NETWORK_ARGS[@]}" \
      --quiet \
      -- initialize \
      --admin "$settlement_admin" >/dev/null ||
      fail "settlement initialize failed — the deploying account must be able to sign as admin ($settlement_admin)"
    ok "settlement initialized"
  fi
fi

info "Done"
step "verify with: ./scripts/verify.sh $NETWORK"
