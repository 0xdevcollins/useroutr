#![no_std]
// `lock` takes 8 arguments by design, and `contractimpl` mirrors the signature
// into the generated client, so the lint also fires on macro output.
#![allow(clippy::too_many_arguments)]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    xdr::ToXdr, Address, Bytes, BytesN, Env,
};

/// Approximate ledgers in a day at 5s close times. Soroban expresses TTLs in
/// ledgers, but an escrow's dispute window is a wall-clock deadline, so the two
/// are bridged through these constants.
const LEDGERS_PER_DAY: u32 = 17_280;
const SECONDS_PER_LEDGER: u64 = 5;
/// Slack on top of the dispute window, so an entry cannot be archived in the
/// gap between the window closing and someone calling `auto_release`.
const TTL_BUFFER_LEDGERS: u32 = LEDGERS_PER_DAY;
/// Floor for settled escrows, which no longer have a live deadline to cover.
const TTL_FLOOR_LEDGERS: u32 = 30 * LEDGERS_PER_DAY;

const BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    Escrow(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ContractPaused = 3,
    EscrowNotFound = 4,
    EscrowAlreadyExists = 5,
    InvalidAmount = 6,
    InvalidPaymentId = 7,
    InvalidParties = 8,
    InvalidReleaseAt = 9,
    NotLocked = 10,
    NotResolvable = 11,
    DisputeWindowClosed = 12,
    ReleaseWindowOpen = 13,
    InvalidSplit = 14,
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EscrowState {
    Locked,
    Released,
    Disputed,
    Refunded,
    PartialRefund,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowEntry {
    pub payer: Address,
    pub merchant: Address,
    /// Useroutr relay — the only party that can release or resolve.
    pub arbiter: Address,
    pub token: Address,
    pub amount: i128,
    pub payment_id: Bytes,
    pub state: EscrowState,
    pub created_at: u64,
    /// Ledger time after which the escrow auto-releases to the merchant.
    pub release_at: u64,
}

#[contractevent(data_format = "vec")]
pub struct Initialized {
    #[topic]
    pub admin: Address,
}

#[contractevent(data_format = "vec")]
pub struct Paused {
    #[topic]
    pub admin: Address,
}

#[contractevent(data_format = "vec")]
pub struct Unpaused {
    #[topic]
    pub admin: Address,
}

#[contractevent(data_format = "vec")]
pub struct Locked {
    #[topic]
    pub escrow_id: BytesN<32>,
    #[topic]
    pub payer: Address,
    #[topic]
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub payment_id: Bytes,
    pub release_at: u64,
}

#[contractevent(data_format = "vec")]
pub struct Released {
    #[topic]
    pub escrow_id: BytesN<32>,
    #[topic]
    pub merchant: Address,
    pub amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Disputed {
    #[topic]
    pub escrow_id: BytesN<32>,
    #[topic]
    pub payer: Address,
}

#[contractevent(data_format = "vec")]
pub struct Resolved {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub payer_amount: i128,
    pub merchant_amount: i128,
    pub state: EscrowState,
}

#[contractevent(data_format = "vec")]
pub struct AutoReleased {
    #[topic]
    pub escrow_id: BytesN<32>,
    #[topic]
    pub merchant: Address,
    pub amount: i128,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Register the admin that can pause the contract. Required before any
    /// escrow can be locked, so an incident always has someone able to halt
    /// new locks.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, EscrowError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);

        Initialized { admin }.publish(&env);
    }

    /// Halt new locks. Existing escrows are untouched: `release`, `dispute`,
    /// `resolve` and `auto_release` all keep working while paused, so funds
    /// already in the contract can always exit.
    pub fn pause(env: Env) {
        let admin = require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &true);

        Paused { admin }.publish(&env);
    }

    pub fn unpause(env: Env) {
        let admin = require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &false);

        Unpaused { admin }.publish(&env);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Pull `amount` from the payer into the contract and hold it until the
    /// arbiter acts or `release_at` passes. Returns the escrow id, derived
    /// deterministically from the payment id and the parties, so the same
    /// payment can never be locked twice.
    pub fn lock(
        env: Env,
        payer: Address,
        merchant: Address,
        arbiter: Address,
        token: Address,
        amount: i128,
        payment_id: Bytes,
        release_at: u64,
    ) -> BytesN<32> {
        payer.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, EscrowError::NotInitialized);
        }
        if Self::is_paused(env.clone()) {
            panic_with_error!(&env, EscrowError::ContractPaused);
        }
        if amount <= 0 {
            panic_with_error!(&env, EscrowError::InvalidAmount);
        }
        if payment_id.is_empty() {
            panic_with_error!(&env, EscrowError::InvalidPaymentId);
        }
        // The arbiter must be a third party. An arbiter that is also the
        // merchant (or the payer) can rule in its own favour, which silently
        // voids every guarantee this contract exists to provide.
        if payer == merchant || arbiter == payer || arbiter == merchant {
            panic_with_error!(&env, EscrowError::InvalidParties);
        }
        if release_at <= env.ledger().timestamp() {
            panic_with_error!(&env, EscrowError::InvalidReleaseAt);
        }

        let escrow_id = escrow_id(&env, &payment_id, &payer, &merchant);
        let key = DataKey::Escrow(escrow_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, EscrowError::EscrowAlreadyExists);
        }

        let vault = env.current_contract_address();
        token::Client::new(&env, &token).transfer(&payer, &vault, &amount);

        let entry = EscrowEntry {
            payer: payer.clone(),
            merchant: merchant.clone(),
            arbiter,
            token: token.clone(),
            amount,
            payment_id: payment_id.clone(),
            state: EscrowState::Locked,
            created_at: env.ledger().timestamp(),
            release_at,
        };
        write_escrow(&env, &key, &entry);

        Locked {
            escrow_id: escrow_id.clone(),
            payer,
            merchant,
            token,
            amount,
            payment_id,
            release_at,
        }
        .publish(&env);

        escrow_id
    }

    /// Arbiter releases the full amount to the merchant. Only valid while the
    /// escrow is `Locked`: a disputed escrow must go through `resolve`.
    pub fn release(env: Env, escrow_id: BytesN<32>) {
        let key = DataKey::Escrow(escrow_id.clone());
        let mut entry = read_escrow(&env, &key);

        entry.arbiter.require_auth();
        if entry.state != EscrowState::Locked {
            panic_with_error!(&env, EscrowError::NotLocked);
        }

        transfer_out(&env, &entry.token, &entry.merchant, entry.amount);

        entry.state = EscrowState::Released;
        write_escrow(&env, &key, &entry);

        Released {
            escrow_id,
            merchant: entry.merchant,
            amount: entry.amount,
        }
        .publish(&env);
    }

    /// Payer opens a dispute before the window closes. Freezes the escrow so
    /// `auto_release` cannot fire; only the arbiter's `resolve` can move funds.
    pub fn dispute(env: Env, escrow_id: BytesN<32>) {
        let key = DataKey::Escrow(escrow_id.clone());
        let mut entry = read_escrow(&env, &key);

        entry.payer.require_auth();
        if entry.state != EscrowState::Locked {
            panic_with_error!(&env, EscrowError::NotLocked);
        }
        if env.ledger().timestamp() >= entry.release_at {
            panic_with_error!(&env, EscrowError::DisputeWindowClosed);
        }

        entry.state = EscrowState::Disputed;
        write_escrow(&env, &key, &entry);

        Disputed {
            escrow_id,
            payer: entry.payer,
        }
        .publish(&env);
    }

    /// Arbiter splits the escrow between payer and merchant. `payer_bps` and
    /// `merchant_bps` must sum to 10_000; the merchant absorbs any rounding
    /// remainder so the escrow always drains to exactly zero.
    ///
    /// Valid from `Locked` (arbiter-initiated refund) and from `Disputed`
    /// (dispute outcome).
    pub fn resolve(env: Env, escrow_id: BytesN<32>, payer_bps: u32, merchant_bps: u32) {
        let key = DataKey::Escrow(escrow_id.clone());
        let mut entry = read_escrow(&env, &key);

        entry.arbiter.require_auth();
        if entry.state != EscrowState::Locked && entry.state != EscrowState::Disputed {
            panic_with_error!(&env, EscrowError::NotResolvable);
        }
        if payer_bps as i128 + merchant_bps as i128 != BPS_DENOMINATOR {
            panic_with_error!(&env, EscrowError::InvalidSplit);
        }

        let payer_amount = (entry.amount * payer_bps as i128) / BPS_DENOMINATOR;
        let merchant_amount = entry.amount - payer_amount;

        transfer_out(&env, &entry.token, &entry.payer, payer_amount);
        transfer_out(&env, &entry.token, &entry.merchant, merchant_amount);

        entry.state = if merchant_amount == 0 {
            EscrowState::Refunded
        } else if payer_amount == 0 {
            EscrowState::Released
        } else {
            EscrowState::PartialRefund
        };
        write_escrow(&env, &key, &entry);

        Resolved {
            escrow_id,
            payer_amount,
            merchant_amount,
            state: entry.state,
        }
        .publish(&env);
    }

    /// Permissionless release to the merchant once the dispute window has
    /// passed with no dispute raised. The merchant never depends on the relay
    /// being online to get paid — this keeps working while the contract is
    /// paused.
    pub fn auto_release(env: Env, escrow_id: BytesN<32>) {
        let key = DataKey::Escrow(escrow_id.clone());
        let mut entry = read_escrow(&env, &key);

        if entry.state != EscrowState::Locked {
            panic_with_error!(&env, EscrowError::NotLocked);
        }
        if env.ledger().timestamp() < entry.release_at {
            panic_with_error!(&env, EscrowError::ReleaseWindowOpen);
        }

        transfer_out(&env, &entry.token, &entry.merchant, entry.amount);

        entry.state = EscrowState::Released;
        write_escrow(&env, &key, &entry);

        AutoReleased {
            escrow_id,
            merchant: entry.merchant,
            amount: entry.amount,
        }
        .publish(&env);
    }

    pub fn get_escrow(env: Env, escrow_id: BytesN<32>) -> EscrowEntry {
        read_escrow(&env, &DataKey::Escrow(escrow_id))
    }

    /// Same derivation `lock` uses, so callers can compute the id off-chain
    /// before the escrow exists.
    pub fn compute_escrow_id(
        env: Env,
        payment_id: Bytes,
        payer: Address,
        merchant: Address,
    ) -> BytesN<32> {
        escrow_id(&env, &payment_id, &payer, &merchant)
    }
}

fn require_admin(env: &Env) -> Address {
    let admin: Address = match env.storage().instance().get(&DataKey::Admin) {
        Some(admin) => admin,
        None => panic_with_error!(env, EscrowError::NotInitialized),
    };
    admin.require_auth();
    admin
}

/// Each component is hashed to a fixed 32 bytes before being concatenated.
/// Appending the raw values would be ambiguous: `payment_id` is variable length
/// and an address's XDR length depends on its type, so a caller could choose a
/// `payment_id` that absorbs the difference and land on the id of someone
/// else's payment.
fn escrow_id(env: &Env, payment_id: &Bytes, payer: &Address, merchant: &Address) -> BytesN<32> {
    let mut preimage = Bytes::new(env);
    preimage.append(&env.crypto().sha256(payment_id).to_bytes().into());
    preimage.append(
        &env.crypto()
            .sha256(&payer.clone().to_xdr(env))
            .to_bytes()
            .into(),
    );
    preimage.append(
        &env.crypto()
            .sha256(&merchant.clone().to_xdr(env))
            .to_bytes()
            .into(),
    );
    env.crypto().sha256(&preimage).to_bytes()
}

/// Ledgers of TTL an entry needs: enough to outlive its dispute window plus a
/// day of slack, floored so a settled escrow stays queryable, and capped at what
/// the network allows. Sizing off the window rather than a fixed constant is
/// what keeps a long-window escrow from being archived — and its funds stranded
/// — before anyone can act on it.
fn required_ttl(env: &Env, release_at: u64) -> u32 {
    let remaining_seconds = release_at.saturating_sub(env.ledger().timestamp());
    let remaining_ledgers = (remaining_seconds / SECONDS_PER_LEDGER).min(u32::MAX as u64) as u32;

    let needed = remaining_ledgers
        .saturating_add(TTL_BUFFER_LEDGERS)
        .max(TTL_FLOOR_LEDGERS);

    needed.min(env.storage().max_ttl())
}

fn read_escrow(env: &Env, key: &DataKey) -> EscrowEntry {
    let entry: EscrowEntry = match env.storage().persistent().get(key) {
        Some(entry) => entry,
        None => panic_with_error!(env, EscrowError::EscrowNotFound),
    };
    extend_escrow_ttl(env, key, entry.release_at);
    entry
}

fn write_escrow(env: &Env, key: &DataKey, entry: &EscrowEntry) {
    env.storage().persistent().set(key, entry);
    extend_escrow_ttl(env, key, entry.release_at);
}

fn extend_escrow_ttl(env: &Env, key: &DataKey, release_at: u64) {
    let ttl = required_ttl(env, release_at);
    // Threshold == extend_to: top the entry back up to the full window on every
    // touch, rather than only once it is nearly expired. The instance entry
    // carries the admin/pause flags, so it must outlive the escrows it guards.
    env.storage().persistent().extend_ttl(key, ttl, ttl);
    env.storage().instance().extend_ttl(ttl, ttl);
}

fn transfer_out(env: &Env, token: &Address, to: &Address, amount: i128) {
    if amount > 0 {
        token::Client::new(env, token).transfer(&env.current_contract_address(), to, &amount);
    }
}

mod test;
