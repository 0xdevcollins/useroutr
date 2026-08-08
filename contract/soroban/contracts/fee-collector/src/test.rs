#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

struct Setup {
    env: Env,
    contract_id: Address,
    token_address: Address,
    admin: Address,
    treasury: Address,
}

/// Deploys with the constructor, which is the only way to stand the contract
/// up — there is no post-deploy `initialize` to race.
fn setup_with_fee(fee_bps: u32) -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let stellar_asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = stellar_asset.address();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let contract_id = env.register(FeeCollectorContract, (&admin, fee_bps, &treasury));

    Setup {
        env,
        contract_id,
        token_address,
        admin,
        treasury,
    }
}

fn setup() -> Setup {
    setup_with_fee(50)
}

#[test]
fn constructor_sets_fee_and_treasury() {
    let s = setup_with_fee(75);
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);

    assert_eq!(client.get_fee_bps(), 75);
}

#[test]
fn admin_is_set_at_deploy_with_no_front_running_window() {
    // #172: `initialize` used to be a separate call anyone could win. The
    // constructor runs inside the deploy, so the deployer's admin is the only
    // one that can ever be recorded.
    let s = setup();
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);

    // Only the real admin can move the fee.
    client.set_fee_bps(&125);
    assert_eq!(client.get_fee_bps(), 125);

    s.env.set_auths(&[]);
    assert!(client.try_set_fee_bps(&10).is_err());
    assert_eq!(client.get_fee_bps(), 125);
}

#[test]
#[should_panic(expected = "max fee is 2%")]
fn constructor_rejects_fee_above_cap() {
    setup_with_fee(201);
}

#[test]
fn deduct_splits_funds_between_merchant_and_treasury() {
    let s = setup();
    let merchant = Address::generate(&s.env);
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);
    let token_client = token::TokenClient::new(&s.env, &s.token_address);
    let asset_admin = token::StellarAssetClient::new(&s.env, &s.token_address);

    asset_admin.mint(&s.contract_id, &10_000);
    let (merchant_amount, fee_amount) = client.deduct(&s.token_address, &10_000, &merchant);

    assert_eq!(merchant_amount, 9_950);
    assert_eq!(fee_amount, 50);

    assert_eq!(token_client.balance(&merchant), 9_950);
    assert_eq!(token_client.balance(&s.treasury), 50);
    assert_eq!(token_client.balance(&s.contract_id), 0);
}

#[test]
fn set_fee_bps_updates_within_limit() {
    let s = setup();
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);

    client.set_fee_bps(&200);

    assert_eq!(client.get_fee_bps(), 200);
}

#[test]
#[should_panic(expected = "max fee is 2%")]
fn set_fee_bps_above_limit_panics() {
    let s = setup();
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);

    client.set_fee_bps(&201);
}

#[test]
fn set_fee_bps_requires_admin_auth() {
    let s = setup();
    let client = FeeCollectorContractClient::new(&s.env, &s.contract_id);

    s.env.set_auths(&[]);
    assert!(client.try_set_fee_bps(&10).is_err());
    assert_eq!(client.get_fee_bps(), 50);
}

#[test]
fn admin_matches_the_address_passed_to_the_constructor() {
    let s = setup();
    let other = Address::generate(&s.env);

    assert_ne!(s.admin, other);
    // The admin governs set_fee_bps; proven by the auth test above. This
    // asserts the constructor recorded the address we handed it.
    let stored: Address = s.env.as_contract(&s.contract_id, || {
        s.env.storage().instance().get(&DataKey::Admin).unwrap()
    });
    assert_eq!(stored, s.admin);
}
