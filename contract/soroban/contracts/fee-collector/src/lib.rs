#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    FeeBps,
    Treasury,
}

#[contractevent(data_format = "vec")]
pub struct Initialized {
    #[topic]
    pub admin: Address,
    pub fee_bps: u32,
    pub treasury: Address,
}

#[contractevent(data_format = "vec")]
pub struct Deducted {
    #[topic]
    pub token: Address,
    #[topic]
    pub merchant: Address,
    pub gross_amount: i128,
    pub merchant_amount: i128,
    pub fee_amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct FeeBpsUpdated {
    pub new_fee_bps: u32,
}

#[contract]
pub struct FeeCollectorContract;

#[contractimpl]
impl FeeCollectorContract {
    /// Runs atomically as part of the deploy transaction, so there is no window
    /// in which an attacker can claim admin of a freshly deployed instance.
    pub fn __constructor(env: Env, admin: Address, fee_bps: u32, treasury: Address) {
        admin.require_auth();
        assert!(fee_bps <= 200, "max fee is 2%");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::Treasury, &treasury);

        Initialized {
            admin,
            fee_bps,
            treasury,
        }
        .publish(&env);
    }

    /// Deduct fee from amount. Returns (merchant_amount, fee_amount).
    pub fn deduct(env: Env, token: Address, gross_amount: i128, merchant: Address) -> (i128, i128) {
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();

        let fee_amount = (gross_amount * fee_bps as i128) / 10_000;
        let merchant_amount = gross_amount - fee_amount;

        let client = token::Client::new(&env, &token);
        client.transfer(&env.current_contract_address(), &merchant, &merchant_amount);
        client.transfer(&env.current_contract_address(), &treasury, &fee_amount);

        Deducted {
            token,
            merchant,
            gross_amount,
            merchant_amount,
            fee_amount,
        }
        .publish(&env);

        (merchant_amount, fee_amount)
    }

    /// Admin can update fee rate (max 200 bps = 2%)
    pub fn set_fee_bps(env: Env, new_fee_bps: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        assert!(new_fee_bps <= 200, "max fee is 2%");
        env.storage().instance().set(&DataKey::FeeBps, &new_fee_bps);

        FeeBpsUpdated { new_fee_bps }.publish(&env);
    }

    /// Always set: the constructor cannot be skipped.
    pub fn get_fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::FeeBps).unwrap()
    }
}

mod test;
