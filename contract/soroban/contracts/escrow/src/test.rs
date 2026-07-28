#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env};

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
#[should_panic]
fn double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.initialize(&admin);
}

#[test]
fn get_admin_returns_none_before_initialize() {
    let env = Env::default();
    let contract_id = env.register(SettlementContract, ());
    let client = SettlementContractClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), None);
}
