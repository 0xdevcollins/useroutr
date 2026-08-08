#!/usr/bin/env bash
#
# Build and deploy every Soroban contract in the workspace. Each contract is
# configured by its __constructor, inside the deploy transaction.
#
#   ./scripts/deploy.sh [testnet|mainnet] [options]
#
#   --yes           skip the mainnet confirmation prompt
#   --skip-build    reuse the wasm already in target/
#   --skip-tests    do not run cargo test first
#   --redeploy      deploy fresh instances even if ids are already recorded
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
# Constructor arguments (passed at deploy time; there is no separate
# initialize step, so these are required, not optional):
#   FEE_COLLECTOR_ADMIN     G… admin (falls back to STELLAR_RELAY_PUBLIC_KEY).
#                           The constructor calls admin.require_auth(), so the
#                           admin must be the deploying account.
#   FEE_COLLECTOR_TREASURY  G… treasury address
#   FEE_BPS                 protocol fee in bps (default 50, max 200)
#   ESCROW_ADMIN            G… admin able to pause new locks
#                           (defaults to FEE_COLLECTOR_ADMIN)

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

NETWORK_ARG="testnet"
ASSUME_YES=0
SKIP_BUILD=0
SKIP_TESTS=0
REDEPLOY=0

while [ $# -gt 0 ]; do
  case "$1" in
    testnet | mainnet | public) NETWORK_ARG="$1" ;;
    -y | --yes) ASSUME_YES=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --redeploy) REDEPLOY=1 ;;
    -h | --help) sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

# Constructor arguments. Resolved before any deploy so a missing admin fails
# fast rather than after the first contract is already on-chain.
ESCROW_ADMIN="${ESCROW_ADMIN:-${FEE_COLLECTOR_ADMIN:-${STELLAR_RELAY_PUBLIC_KEY:-}}}"
FEE_COLLECTOR_ADMIN="${FEE_COLLECTOR_ADMIN:-${STELLAR_RELAY_PUBLIC_KEY:-}}"
FEE_COLLECTOR_TREASURY="${FEE_COLLECTOR_TREASURY:-}"
FEE_BPS="${FEE_BPS:-50}"
export ESCROW_ADMIN FEE_COLLECTOR_ADMIN FEE_COLLECTOR_TREASURY FEE_BPS

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
# A constructor argument cannot be supplied after the fact, so a contract that
# is missing one cannot be deployed at all. Check before spending any fees.
for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  env_var="${entry##*:}"
  existing="$(lookup_contract_id "$env_var" "$name")"
  [ -n "$existing" ] && [ "$existing" != "C..." ] && [ "$REDEPLOY" -eq 0 ] && continue
  while read -r var; do
    [ -n "$var" ] || continue
    [ -n "${!var:-}" ] || fail "$name needs $var set — it is a constructor argument"
  done <<<"$(required_admin_vars "$name")"
done

info "Deploying"

declare -a DEPLOYED_NAMES=()
declare -a DEPLOYED_IDS=()

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
  # Constructor args run inside the deploy transaction, so the contract is
  # configured the moment it exists.
  ctor_args=()
  while read -r arg; do
    [ -n "$arg" ] || continue
    ctor_args+=("$arg")
  done <<<"$(constructor_args "$name")"

  # The id is the last line of stdout; `set -o pipefail` still surfaces a
  # failed deploy through the pipe.
  contract_id="$(stellar contract deploy \
    --wasm "$wasm" \
    "${NETWORK_ARGS[@]}" \
    --quiet \
    ${ctor_args[@]+-- "${ctor_args[@]}"} | tail -n 1)"

  [ -n "$contract_id" ] || fail "$name deploy returned no contract id"

  upsert_env_var "$env_var" "$contract_id"
  ok "$name → $contract_id"
  step "wrote $env_var to $(env_file)"

  DEPLOYED_NAMES+=("$name")
  DEPLOYED_IDS+=("$contract_id")
done


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

info "Done"
step "verify with: ./scripts/verify.sh $NETWORK"
