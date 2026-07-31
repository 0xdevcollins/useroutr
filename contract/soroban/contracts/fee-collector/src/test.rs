#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FeeCollectorContract, ());

    let token_admin = Address::generate(&env);
    let stellar_asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = stellar_asset.address();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    (env, contract_id, token_address, admin, treasury)
}

#[test]
fn get_fee_bps_defaults_to_50_before_initialize() {
    let (env, contract_id, _token_address, _admin, _treasury) = setup();
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    assert_eq!(client.get_fee_bps(), 50);
}

#[test]
fn initialize_sets_fee_and_treasury() {
    let (env, contract_id, _token_address, admin, treasury) = setup();
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    client.initialize(&admin, &75, &treasury);

    assert_eq!(client.get_fee_bps(), 75);
}

#[test]
fn deduct_splits_funds_between_merchant_and_treasury() {
    let (env, contract_id, token_address, admin, treasury) = setup();
    let merchant = Address::generate(&env);
    let client = FeeCollectorContractClient::new(&env, &contract_id);
    let token_client = token::TokenClient::new(&env, &token_address);
    let asset_admin = token::StellarAssetClient::new(&env, &token_address);

    client.initialize(&admin, &50, &treasury);

    asset_admin.mint(&contract_id, &10_000);
    let (merchant_amount, fee_amount) = client.deduct(&token_address, &10_000, &merchant);

    assert_eq!(merchant_amount, 9_950);
    assert_eq!(fee_amount, 50);

    assert_eq!(token_client.balance(&merchant), 9_950);
    assert_eq!(token_client.balance(&treasury), 50);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn set_fee_bps_updates_within_limit() {
    let (env, contract_id, _token_address, admin, treasury) = setup();
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    client.initialize(&admin, &50, &treasury);
    client.set_fee_bps(&200);

    assert_eq!(client.get_fee_bps(), 200);
}

#[test]
#[should_panic(expected = "max fee is 2%")]
fn set_fee_bps_above_limit_panics() {
    let (env, contract_id, _token_address, admin, treasury) = setup();
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    client.initialize(&admin, &50, &treasury);
    client.set_fee_bps(&201);
}

#[test]
fn double_initialize_fails_with_already_initialized() {
    let (env, contract_id, _token_address, admin, treasury) = setup();
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    client.initialize(&admin, &75, &treasury);

    let result = client.try_initialize(&admin, &75, &treasury);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            FeeCollectorError::AlreadyInitialized as u32
        )))
    );
}

#[test]
#[should_panic]
fn deduct_before_initialize_panics() {
    let (env, contract_id, token_address, _admin, _treasury) = setup();
    let merchant = Address::generate(&env);
    let client = FeeCollectorContractClient::new(&env, &contract_id);

    let _ = client.deduct(&token_address, &1_000, &merchant);
}
