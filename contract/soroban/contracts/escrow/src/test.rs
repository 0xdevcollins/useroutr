#![cfg(test)]

use super::*;
use soroban_sdk::testutils::storage::Persistent as _;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Bytes, Env};

const WINDOW: u64 = 86_400;
const AMOUNT: i128 = 10_000;
const START_TS: u64 = 1_000;

struct Setup {
    env: Env,
    client: EscrowContractClient<'static>,
    contract_id: Address,
    token: Address,
    token_client: token::TokenClient<'static>,
    admin: Address,
    payer: Address,
    merchant: Address,
    arbiter: Address,
    payment_id: Bytes,
}

/// Deploys via the constructor, which is the only way to stand the contract
/// up — there is no post-deploy `initialize` to race (#172).
fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(START_TS);

    let token_admin = Address::generate(&env);
    let stellar_asset = env.register_stellar_asset_contract_v2(token_admin);
    let token = stellar_asset.address();

    let admin = Address::generate(&env);
    let contract_id = env.register(EscrowContract, (&admin,));
    let client = EscrowContractClient::new(&env, &contract_id);
    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let arbiter = Address::generate(&env);

    token::StellarAssetClient::new(&env, &token).mint(&payer, &AMOUNT);

    let payment_id = Bytes::from_array(&env, &[7u8; 16]);
    let token_client = token::TokenClient::new(&env, &token);

    Setup {
        env,
        client,
        contract_id,
        token,
        token_client,
        admin,
        payer,
        merchant,
        arbiter,
        payment_id,
    }
}

impl Setup {
    fn lock(&self) -> BytesN<32> {
        self.lock_amount(AMOUNT)
    }

    fn lock_amount(&self, amount: i128) -> BytesN<32> {
        self.lock_with_window(amount, WINDOW)
    }

    fn lock_with_window(&self, amount: i128, window: u64) -> BytesN<32> {
        self.client.lock(
            &self.payer,
            &self.merchant,
            &self.arbiter,
            &self.token,
            &amount,
            &self.payment_id,
            &(self.env.ledger().timestamp() + window),
        )
    }

    fn try_lock_default(&self) -> Result<(), ()> {
        self.client
            .try_lock(
                &self.payer,
                &self.merchant,
                &self.arbiter,
                &self.token,
                &AMOUNT,
                &self.payment_id,
                &(START_TS + WINDOW),
            )
            .map(|_| ())
            .map_err(|_| ())
    }

    fn advance_past_window(&self) {
        let now = self.env.ledger().timestamp();
        self.env.ledger().set_timestamp(now + WINDOW + 1);
    }

    /// TTL currently granted to the escrow entry, in ledgers.
    fn escrow_ttl(&self, escrow_id: &BytesN<32>) -> u32 {
        let key = DataKey::Escrow(escrow_id.clone());
        self.env.as_contract(&self.contract_id, || {
            self.env.storage().persistent().get_ttl(&key)
        })
    }

    fn max_ttl(&self) -> u32 {
        self.env
            .as_contract(&self.contract_id, || self.env.storage().max_ttl())
    }
}

/// A `try_*` result must carry exactly this contract error.
fn assert_err<T: core::fmt::Debug, C: core::fmt::Debug>(
    result: Result<Result<T, C>, Result<soroban_sdk::Error, soroban_sdk::InvokeError>>,
    expected: EscrowError,
) {
    match result {
        Err(Ok(err)) => assert_eq!(
            err,
            soroban_sdk::Error::from_contract_error(expected as u32),
            "wrong contract error"
        ),
        other => panic!("expected {expected:?}, got {other:?}"),
    }
}

// ── constructor & pause ──────────────────────────────────────────────────────

#[test]
fn constructor_sets_admin() {
    let s = setup();

    assert_eq!(s.client.get_admin(), s.admin);
    assert!(!s.client.is_paused());
}

#[test]
fn admin_is_set_at_deploy_with_no_front_running_window() {
    // #172: `initialize` used to be a separate call anyone could win, and the
    // re-init guard made a stolen admin permanent. The constructor runs inside
    // the deploy, so only the deployer's admin can ever be recorded — and there
    // is no entry point left that could claim it.
    let s = setup();
    let attacker = Address::generate(&s.env);

    assert_eq!(s.client.get_admin(), s.admin);
    assert_ne!(s.client.get_admin(), attacker);

    // The pause switch answers to that admin and nobody else.
    s.env.set_auths(&[]);
    assert!(s.client.try_pause().is_err());
    assert!(!s.client.is_paused());
}

#[test]
fn locking_works_immediately_after_deploy() {
    // There is no un-initialized state to fall into: a contract is usable the
    // moment it exists.
    let s = setup();

    let escrow_id = s.lock();

    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Locked);
}

#[test]
fn pause_blocks_new_locks() {
    let s = setup();
    s.client.pause();
    assert!(s.client.is_paused());

    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.arbiter,
        &s.token,
        &AMOUNT,
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::ContractPaused);
    assert_eq!(s.token_client.balance(&s.payer), AMOUNT);
}

#[test]
fn unpause_restores_locking() {
    let s = setup();
    s.client.pause();
    s.client.unpause();

    assert!(!s.client.is_paused());
    assert!(s.try_lock_default().is_ok());
    assert_eq!(s.token_client.balance(&s.contract_id), AMOUNT);
}

#[test]
fn pause_does_not_block_release() {
    // The point of pausing only `lock`: money already in the contract must
    // still be able to exit through every path.
    let s = setup();
    let escrow_id = s.lock();
    s.client.pause();

    s.client.release(&escrow_id);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
}

#[test]
fn pause_does_not_block_resolve() {
    let s = setup();
    let escrow_id = s.lock();
    s.client.pause();

    s.client.resolve(&escrow_id, &10_000, &0);

    assert_eq!(s.token_client.balance(&s.payer), AMOUNT);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
}

#[test]
fn pause_does_not_block_auto_release() {
    let s = setup();
    let escrow_id = s.lock();
    s.client.pause();
    s.advance_past_window();

    s.client.auto_release(&escrow_id);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
}

#[test]
fn pause_does_not_block_dispute() {
    let s = setup();
    let escrow_id = s.lock();
    s.client.pause();

    s.client.dispute(&escrow_id);

    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Disputed);
}

#[test]
fn pause_requires_admin_auth() {
    let s = setup();
    s.env.set_auths(&[]);

    assert!(s.client.try_pause().is_err());
    assert!(!s.client.is_paused());
}

// ── lock ─────────────────────────────────────────────────────────────────────

#[test]
fn lock_moves_funds_into_escrow_and_records_entry() {
    let s = setup();
    let escrow_id = s.lock();

    assert_eq!(s.token_client.balance(&s.payer), 0);
    assert_eq!(s.token_client.balance(&s.contract_id), AMOUNT);

    let entry = s.client.get_escrow(&escrow_id);
    assert_eq!(entry.payer, s.payer);
    assert_eq!(entry.merchant, s.merchant);
    assert_eq!(entry.arbiter, s.arbiter);
    assert_eq!(entry.token, s.token);
    assert_eq!(entry.amount, AMOUNT);
    assert_eq!(entry.payment_id, s.payment_id);
    assert_eq!(entry.state, EscrowState::Locked);
    assert_eq!(entry.created_at, START_TS);
    assert_eq!(entry.release_at, START_TS + WINDOW);
}

#[test]
fn escrow_id_is_deterministic() {
    let s = setup();
    let expected = s
        .client
        .compute_escrow_id(&s.payment_id, &s.payer, &s.merchant);

    assert_eq!(s.lock(), expected);
}

#[test]
fn lock_rejects_duplicate_payment_id() {
    let s = setup();
    s.lock_amount(AMOUNT / 2);

    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.arbiter,
        &s.token,
        &(AMOUNT / 2),
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::EscrowAlreadyExists);
}

#[test]
fn lock_rejects_zero_amount() {
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.arbiter,
        &s.token,
        &0,
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::InvalidAmount);
}

#[test]
fn lock_rejects_past_release_at() {
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.arbiter,
        &s.token,
        &AMOUNT,
        &s.payment_id,
        &(START_TS - 1),
    );
    assert_err(result, EscrowError::InvalidReleaseAt);
}

#[test]
fn lock_rejects_payer_as_merchant() {
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.payer,
        &s.arbiter,
        &s.token,
        &AMOUNT,
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::InvalidParties);
}

#[test]
fn lock_rejects_arbiter_that_is_the_merchant() {
    // An arbiter who is also the merchant can `release` to itself immediately,
    // which makes the dispute window meaningless.
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.merchant,
        &s.token,
        &AMOUNT,
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::InvalidParties);
}

#[test]
fn lock_rejects_arbiter_that_is_the_payer() {
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.payer,
        &s.token,
        &AMOUNT,
        &s.payment_id,
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::InvalidParties);
}

#[test]
fn escrow_id_does_not_collide_across_payment_id_boundaries() {
    // Components are hashed before concatenation, so a longer payment_id
    // cannot absorb bytes from the adjacent address and land on another
    // payment's id.
    let s = setup();
    let a = s
        .client
        .compute_escrow_id(&Bytes::from_array(&s.env, &[1, 2]), &s.payer, &s.merchant);
    let b = s
        .client
        .compute_escrow_id(&Bytes::from_array(&s.env, &[1]), &s.payer, &s.merchant);
    let c = s
        .client
        .compute_escrow_id(&Bytes::from_array(&s.env, &[1, 2]), &s.merchant, &s.payer);

    assert_ne!(a, b);
    assert_ne!(a, c);
    assert_ne!(b, c);
}

#[test]
fn lock_rejects_empty_payment_id() {
    let s = setup();
    let result = s.client.try_lock(
        &s.payer,
        &s.merchant,
        &s.arbiter,
        &s.token,
        &AMOUNT,
        &Bytes::new(&s.env),
        &(START_TS + WINDOW),
    );
    assert_err(result, EscrowError::InvalidPaymentId);
}

// ── storage TTL ──────────────────────────────────────────────────────────────

#[test]
fn ttl_covers_the_dispute_window_plus_a_day() {
    let s = setup();
    // A 90-day window outlives any fixed 30-day extension — exactly the case
    // that would archive a live escrow and strand its funds.
    let window = 90 * 24 * 60 * 60;
    let escrow_id = s.lock_with_window(AMOUNT, window);

    let window_in_ledgers = (window / SECONDS_PER_LEDGER) as u32;
    let ttl = s.escrow_ttl(&escrow_id);

    assert!(
        ttl >= window_in_ledgers,
        "ttl {ttl} does not outlive the {window_in_ledgers}-ledger window"
    );
    assert_eq!(ttl, window_in_ledgers + TTL_BUFFER_LEDGERS);
}

#[test]
fn ttl_never_drops_below_the_floor() {
    let s = setup();
    // A one-hour window needs far less than the floor; the entry should still
    // get the floor so it stays queryable after settlement.
    let escrow_id = s.lock_with_window(AMOUNT, 3_600);

    assert_eq!(s.escrow_ttl(&escrow_id), TTL_FLOOR_LEDGERS);
}

#[test]
fn reads_top_the_ttl_back_up() {
    let s = setup();
    let escrow_id = s.lock_with_window(AMOUNT, 90 * 24 * 60 * 60);
    let ttl_at_lock = s.escrow_ttl(&escrow_id);

    // Burn down part of the TTL, then touch the entry.
    let seq = s.env.ledger().sequence();
    s.env
        .ledger()
        .set_sequence_number(seq + 10 * LEDGERS_PER_DAY);
    assert!(s.escrow_ttl(&escrow_id) < ttl_at_lock);

    s.client.get_escrow(&escrow_id);

    // Wall-clock has not moved, so the window is unchanged and the entry is
    // topped straight back up.
    assert_eq!(s.escrow_ttl(&escrow_id), ttl_at_lock);
}

#[test]
fn ttl_is_capped_at_the_network_maximum() {
    let s = setup();
    // Ten years of window: the request must clamp, not overflow or revert.
    let escrow_id = s.lock_with_window(AMOUNT, 10 * 365 * 24 * 60 * 60);

    assert_eq!(s.escrow_ttl(&escrow_id), s.max_ttl());
}

// ── release ──────────────────────────────────────────────────────────────────

#[test]
fn release_pays_merchant_in_full() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.release(&escrow_id);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Released);
}

#[test]
fn release_is_not_replayable() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.release(&escrow_id);
    assert_err(s.client.try_release(&escrow_id), EscrowError::NotLocked);
}

#[test]
fn release_requires_arbiter_auth() {
    let s = setup();
    let escrow_id = s.lock();

    s.env.set_auths(&[]);
    assert!(s.client.try_release(&escrow_id).is_err());
    assert_eq!(s.token_client.balance(&s.contract_id), AMOUNT);
}

// ── dispute ──────────────────────────────────────────────────────────────────

#[test]
fn dispute_freezes_escrow_within_window() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);

    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Disputed);
    assert_eq!(s.token_client.balance(&s.contract_id), AMOUNT);
}

#[test]
fn dispute_after_window_fails() {
    let s = setup();
    let escrow_id = s.lock();

    s.advance_past_window();
    assert_err(
        s.client.try_dispute(&escrow_id),
        EscrowError::DisputeWindowClosed,
    );
}

#[test]
fn release_of_disputed_escrow_fails() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    assert_err(s.client.try_release(&escrow_id), EscrowError::NotLocked);
}

// ── auto_release ─────────────────────────────────────────────────────────────

#[test]
fn auto_release_pays_merchant_after_window() {
    let s = setup();
    let escrow_id = s.lock();

    s.advance_past_window();
    s.client.auto_release(&escrow_id);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Released);
}

#[test]
fn auto_release_needs_no_auth() {
    let s = setup();
    let escrow_id = s.lock();

    s.advance_past_window();
    s.env.set_auths(&[]);
    s.client.auto_release(&escrow_id);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
}

#[test]
fn auto_release_before_window_fails() {
    let s = setup();
    let escrow_id = s.lock();

    assert_err(
        s.client.try_auto_release(&escrow_id),
        EscrowError::ReleaseWindowOpen,
    );
}

#[test]
fn auto_release_blocked_while_disputed() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    s.advance_past_window();
    assert_err(
        s.client.try_auto_release(&escrow_id),
        EscrowError::NotLocked,
    );
}

// ── resolve ──────────────────────────────────────────────────────────────────

#[test]
fn resolve_splits_funds_between_parties() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    s.client.resolve(&escrow_id, &3_000, &7_000);

    assert_eq!(s.token_client.balance(&s.payer), 3_000);
    assert_eq!(s.token_client.balance(&s.merchant), 7_000);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
    assert_eq!(
        s.client.get_escrow(&escrow_id).state,
        EscrowState::PartialRefund
    );
}

#[test]
fn resolve_full_refund_returns_everything_to_payer() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    s.client.resolve(&escrow_id, &10_000, &0);

    assert_eq!(s.token_client.balance(&s.payer), AMOUNT);
    assert_eq!(s.token_client.balance(&s.merchant), 0);
    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Refunded);
}

#[test]
fn resolve_full_award_marks_escrow_released() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    s.client.resolve(&escrow_id, &0, &10_000);

    assert_eq!(s.token_client.balance(&s.merchant), AMOUNT);
    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Released);
}

#[test]
fn resolve_works_on_undisputed_escrow_for_arbiter_refunds() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.resolve(&escrow_id, &10_000, &0);

    assert_eq!(s.token_client.balance(&s.payer), AMOUNT);
    assert_eq!(s.client.get_escrow(&escrow_id).state, EscrowState::Refunded);
}

#[test]
fn resolve_rounding_remainder_goes_to_merchant() {
    let s = setup();
    // 3 units at 50/50 cannot split evenly.
    let escrow_id = s.lock_amount(3);

    s.client.resolve(&escrow_id, &5_000, &5_000);

    assert_eq!(s.token_client.balance(&s.payer), AMOUNT - 3 + 1);
    assert_eq!(s.token_client.balance(&s.merchant), 2);
    assert_eq!(s.token_client.balance(&s.contract_id), 0);
}

#[test]
fn resolve_rejects_bps_that_do_not_sum() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.dispute(&escrow_id);
    assert_err(
        s.client.try_resolve(&escrow_id, &5_000, &4_000),
        EscrowError::InvalidSplit,
    );
}

#[test]
fn resolve_is_not_replayable() {
    let s = setup();
    let escrow_id = s.lock();

    s.client.resolve(&escrow_id, &5_000, &5_000);
    assert_err(
        s.client.try_resolve(&escrow_id, &5_000, &5_000),
        EscrowError::NotResolvable,
    );
}

#[test]
fn resolve_requires_arbiter_auth() {
    let s = setup();
    let escrow_id = s.lock();

    s.env.set_auths(&[]);
    assert!(s.client.try_resolve(&escrow_id, &10_000, &0).is_err());
    assert_eq!(s.token_client.balance(&s.contract_id), AMOUNT);
}

// ── reads ────────────────────────────────────────────────────────────────────

#[test]
fn get_escrow_fails_for_unknown_id() {
    let s = setup();
    let unknown = BytesN::from_array(&s.env, &[0u8; 32]);

    assert_err(
        s.client.try_get_escrow(&unknown),
        EscrowError::EscrowNotFound,
    );
}
