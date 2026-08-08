#!/usr/bin/env bash
# Shared helpers for the Soroban deploy/verify scripts.
# Sourced, not executed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOROBAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SOROBAN_DIR/../.." && pwd)"
DEPLOYMENTS_DIR="$SOROBAN_DIR/deployments"
# `stellar contract build` emits wasm32v1-none; a plain `cargo build --target
# wasm32-unknown-unknown` (what .github/workflows/contracts.yml does) emits the
# other. Accept either so a deploy works whichever way the wasm was produced.
WASM_DIRS=(
  "$SOROBAN_DIR/target/wasm32v1-none/release"
  "$SOROBAN_DIR/target/wasm32-unknown-unknown/release"
)

# Echo the path to <name>.wasm, preferring the most recently built copy.
find_wasm() {
  local name="$1" dir newest=""
  for dir in "${WASM_DIRS[@]}"; do
    if [ -f "$dir/$name.wasm" ]; then
      if [ -z "$newest" ] || [ "$dir/$name.wasm" -nt "$newest" ]; then
        newest="$dir/$name.wasm"
      fi
    fi
  done
  printf '%s' "$newest"
}

# ── Contract manifest ────────────────────────────────────────────────────────
# One line per deployable contract: "<wasm-stem>:<env-var>". The wasm stem is
# the crate name with `-` replaced by `_`, which is what cargo emits. Add new
# contracts here and both deploy.sh and verify.sh pick them up.
CONTRACTS=(
  "escrow:SOROBAN_ESCROW_CONTRACT_ID"
  "fee_collector:SOROBAN_FEE_COLLECTOR_CONTRACT_ID"
  "settlement:SOROBAN_SETTLEMENT_CONTRACT_ID"
)

TESTNET_PASSPHRASE="Test SDF Network ; September 2015"
MAINNET_PASSPHRASE="Public Global Stellar Network ; September 2015"
DEFAULT_TESTNET_RPC="https://soroban-testnet.stellar.org"

# ── Output ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""
fi

info()  { printf '%s\n' "${C_BOLD}$*${C_RESET}"; }
step()  { printf '%s\n' "${C_DIM}  $*${C_RESET}"; }
ok()    { printf '%s\n' "${C_GREEN}  ✓ $*${C_RESET}"; }
warn()  { printf '%s\n' "${C_YELLOW}  ! $*${C_RESET}" >&2; }
fail()  { printf '%s\n' "${C_RED}  ✗ $*${C_RESET}" >&2; exit 1; }

# ── Network resolution ───────────────────────────────────────────────────────
# Sets NETWORK, NETWORK_PASSPHRASE, RPC_URL and the NETWORK_ARGS array used by
# every `stellar` call. Named networks from the CLI's own config are bypassed
# on purpose so a deploy never depends on the operator's local `stellar network`
# setup.
resolve_network() {
  NETWORK="${1:-testnet}"

  case "$NETWORK" in
    testnet)
      NETWORK_PASSPHRASE="$TESTNET_PASSPHRASE"
      RPC_URL="${STELLAR_SOROBAN_RPC_URL:-$DEFAULT_TESTNET_RPC}"
      ;;
    mainnet | public)
      NETWORK="mainnet"
      NETWORK_PASSPHRASE="$MAINNET_PASSPHRASE"
      # There is no free public mainnet RPC — the operator must name a provider.
      RPC_URL="${STELLAR_SOROBAN_RPC_URL:-}"
      [ -n "$RPC_URL" ] ||
        fail "mainnet needs STELLAR_SOROBAN_RPC_URL set to your RPC provider"
      ;;
    *)
      fail "unknown network '$NETWORK' (expected testnet or mainnet)"
      ;;
  esac

  NETWORK_ARGS=(--rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE")
}

# ── .env handling ────────────────────────────────────────────────────────────
env_file() { printf '%s' "${ENV_FILE:-$REPO_ROOT/.env}"; }

# Read a value out of the env file, ignoring comments. Empty if unset.
read_env_var() {
  local key="$1" file
  file="$(env_file)"
  [ -f "$file" ] || return 0
  sed -n "s/^[[:space:]]*${key}=//p" "$file" | tail -n 1 | sed 's/^"//; s/"$//'
}

# Set KEY="value", replacing an existing assignment rather than appending a
# duplicate — deploys are re-run often and a file full of stale shadowed keys
# is how you ship the wrong contract id.
upsert_env_var() {
  local key="$1" value="$2" file tmp
  file="$(env_file)"

  [ -f "$file" ] || : >"$file"

  tmp="$(mktemp)"
  if grep -q "^[[:space:]]*${key}=" "$file"; then
    awk -v key="$key" -v val="$value" '
      $0 ~ "^[[:space:]]*" key "=" && !done { print key "=\"" val "\""; done = 1; next }
      { print }
    ' "$file" >"$tmp"
  else
    cat "$file" >"$tmp"
    # Append a newline first if the file does not end with one, so the new
    # assignment does not get glued onto the last line.
    if [ -s "$tmp" ] && [ -n "$(tail -c 1 "$tmp")" ]; then
      printf '\n' >>"$tmp"
    fi
    printf '%s="%s"\n' "$key" "$value" >>"$tmp"
  fi
  mv "$tmp" "$file"
}

# ── Deployment record ────────────────────────────────────────────────────────
deployment_file() { printf '%s/%s.json' "$DEPLOYMENTS_DIR" "$NETWORK"; }

# Look up a previously recorded contract id: env var first (it is what the API
# actually reads), then the deployment record.
lookup_contract_id() {
  local env_var="$1" name="$2" id
  id="$(read_env_var "$env_var")"
  if [ -z "$id" ] && [ -f "$(deployment_file)" ]; then
    id="$(sed -n "s/.*\"${name}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$(deployment_file)")"
  fi
  printf '%s' "$id"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed ($2)"
}
