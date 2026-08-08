#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

#[test]
fn constructor_sets_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(SettlementContract, (&admin,));
    let client = SettlementContractClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), admin);
}

#[test]
fn admin_is_set_before_any_other_call_can_run() {
    // The front-running window #172 described is gone: there is no entry point
    // that can claim admin, and no reachable state where admin is unset.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let contract_id = env.register(SettlementContract, (&admin,));
    let client = SettlementContractClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), admin);
    assert_ne!(client.get_admin(), attacker);
}

#[test]
fn each_deploy_gets_its_own_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin_a = Address::generate(&env);
    let admin_b = Address::generate(&env);

    let a = SettlementContractClient::new(&env, &env.register(SettlementContract, (&admin_a,)));
    let b = SettlementContractClient::new(&env, &env.register(SettlementContract, (&admin_b,)));

    assert_eq!(a.get_admin(), admin_a);
    assert_eq!(b.get_admin(), admin_b);
}
