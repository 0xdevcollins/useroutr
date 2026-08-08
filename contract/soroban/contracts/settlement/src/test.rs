#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

#[test]
fn initialize_sets_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert_eq!(client.get_admin(), Some(admin));
}

#[test]
fn double_initialize_fails_with_already_initialized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let result = client.try_initialize(&admin);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            SettlementError::AlreadyInitialized as u32
        )))
    );
}

#[test]
fn get_admin_returns_none_before_initialize() {
    let env = Env::default();
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), None);
}
