#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct SettlementContract;

#[contractimpl]
impl SettlementContract {
    /// Runs atomically as part of the deploy transaction, so there is no window
    /// in which an attacker can claim admin of a freshly deployed instance.
    pub fn __constructor(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Always set: the constructor cannot be skipped.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

mod test;
