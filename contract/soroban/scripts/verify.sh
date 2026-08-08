#!/usr/bin/env bash
#
# Confirm every deployed Soroban contract is live on-chain, exposes the
# interface we expect, matches the id in .env, and is initialized.
#
#   ./scripts/verify.sh [testnet|mainnet]
#
# Exits non-zero if any check fails, so CI can gate on it.
#
# Required:
#   SOROBAN_DEPLOY_SECRET or STELLAR_SECRET_KEY or STELLAR_RELAY_KEYPAIR_SECRET
#     — any funded account; verification only simulates, it never submits.
# Required on mainnet:
#   STELLAR_SOROBAN_RPC_URL

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

NETWORK_ARG="${1:-testnet}"
case "$NETWORK_ARG" in
  -h | --help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac

resolve_network "$NETWORK_ARG"
require_cmd stellar "https://developers.stellar.org/docs/tools/cli"

SOURCE_ACCOUNT="${SOROBAN_DEPLOY_SECRET:-${STELLAR_SECRET_KEY:-${STELLAR_RELAY_KEYPAIR_SECRET:-}}}"
[ -n "$SOURCE_ACCOUNT" ] ||
  fail "set SOROBAN_DEPLOY_SECRET (or STELLAR_SECRET_KEY) to a funded account"

# Via the environment, not argv — see the note in deploy.sh.
export STELLAR_ACCOUNT="$SOURCE_ACCOUNT"

# Entry points the deployed wasm must expose. Guards against a stale or wrong
# wasm sitting at the recorded id.
expected_fns() {
  case "$1" in
    escrow) printf '%s\n' pause unpause is_paused lock release dispute resolve auto_release expire_dispute get_escrow get_admin ;;
    fee_collector) printf '%s\n' deduct set_fee_bps get_fee_bps ;;
    settlement) printf '%s\n' get_admin ;;
  esac
}

info "Verifying Soroban contracts on ${NETWORK}"
step "rpc      $RPC_URL"
step "env file $(env_file)"

FAILURES=0
note_failure() { warn "$1"; FAILURES=$((FAILURES + 1)); }

record="$(deployment_file)"
[ -f "$record" ] || warn "no deployment record at ${record#"$REPO_ROOT"/} — checking .env only"

for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  env_var="${entry##*:}"

  info "$name"

  env_id="$(read_env_var "$env_var")"
  if [ -z "$env_id" ] || [ "$env_id" = "C..." ]; then
    note_failure "$env_var is not set in $(env_file)"
    continue
  fi
  ok "$env_var = $env_id"

  # The .env is what the API reads; the record is what we last deployed. A
  # mismatch means one of them was hand-edited — worth failing on.
  if [ -f "$record" ]; then
    recorded="$(sed -n "s/.*\"${name}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$record")"
    if [ -z "$recorded" ]; then
      warn "not present in ${record##*/}"
    elif [ "$recorded" != "$env_id" ]; then
      note_failure "id mismatch: .env has $env_id, ${record##*/} has $recorded"
      continue
    else
      ok "matches ${record##*/}"
    fi
  fi

  # Fetching the interface proves the instance exists and is not archived; a
  # wrong or evicted id fails here.
  if ! interface="$(stellar contract info interface --id "$env_id" \
    "${NETWORK_ARGS[@]}" --quiet 2>/dev/null)"; then
    note_failure "no live contract at $env_id"
    continue
  fi
  ok "live on $NETWORK"

  missing=""
  while read -r fn; do
    [ -n "$fn" ] || continue
    grep -q "fn ${fn}(" <<<"$interface" || missing="$missing $fn"
  done <<<"$(expected_fns "$name")"

  if [ -n "$missing" ]; then
    note_failure "deployed wasm is missing:$missing"
    continue
  fi
  ok "interface exposes all expected entry points"

  case "$name" in
    fee_collector)
      fee_bps="$(stellar contract invoke \
        --id "$env_id" \
        "${NETWORK_ARGS[@]}" \
        --send=no --quiet \
        -- get_fee_bps 2>/dev/null || true)"
      if [ -z "$fee_bps" ]; then
        note_failure "get_fee_bps returned nothing"
      elif ! [ "$fee_bps" -le 200 ] 2>/dev/null; then
        note_failure "fee_bps=$fee_bps exceeds the 200 bps cap"
      else
        ok "fee_bps = $fee_bps"
      fi
      ;;
    escrow | settlement)
      # The constructor guarantees an admin, so a missing one means the
      # deployed wasm is not what we think it is.
      admin="$(stellar contract invoke \
        --id "$env_id" \
        "${NETWORK_ARGS[@]}" \
        --send=no --quiet \
        -- get_admin 2>/dev/null || true)"
      if [ -z "$admin" ] || [ "$admin" = "null" ]; then
        note_failure "get_admin returned no admin"
      else
        ok "admin = $(tr -d '"' <<<"$admin")"
      fi
      if [ "$name" = "escrow" ]; then
        paused="$(stellar contract invoke \
          --id "$env_id" \
            "${NETWORK_ARGS[@]}" \
          --send=no --quiet \
          -- is_paused 2>/dev/null || true)"
        if [ "$paused" = "true" ]; then
          warn "contract is PAUSED — no new locks will be accepted"
        else
          ok "accepting new locks"
        fi
      fi
      ;;
  esac
done

echo
if [ "$FAILURES" -eq 0 ]; then
  info "${C_GREEN}All contracts verified on ${NETWORK}${C_RESET}"
else
  fail "$FAILURES check(s) failed"
fi
