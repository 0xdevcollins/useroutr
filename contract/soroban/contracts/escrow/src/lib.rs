#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env};
use soroban_sdk::panic_with_error;

#[contracttype]
pub enum DataKey {
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum SettlementError {
    AlreadyInitialized = 8,
}

#[contract]
pub struct SettlementContract;

#[contractimpl]
impl SettlementContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, SettlementError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

mod test;
