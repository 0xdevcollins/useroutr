import { ethers } from 'ethers';
import { TOKEN_MESSENGER_V2_ABI } from './evm-cctp.client';

/**
 * The `DepositForBurn` log from tx 0xce93dc50…c46ca1c9 on Sepolia
 * (block 11454876, status 0x1), copied verbatim off the chain.
 */
const fixture = {
  depositForBurnLog: {
    topics: [
      '0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5',
      '0x0000000000000000000000001c7d4b196cb0c7b01d743fbc6116a902379c7238',
      '0x0000000000000000000000001eeb66317dea19f0c655a55c55f8c6293d488114',
      '0x00000000000000000000000000000000000000000000000000000000000003e8',
    ],
    data: '0x00000000000000000000000000000000000000000000000000000000000027103de86ac50b47eaf2840fe23e48179551660fd1072fba6f445d4a6bd7af4ab93e000000000000000000000000000000000000000000000000000000000000001bda6f9ee0786c812344d82817ef19b648b4af120f8bd10bf658e6b99eacff24b80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000058000000000000000000000000000000000000000000000000000000000000003847414855325a48505357574d554e53423355424844504452425a5345514b5348495156523252375741564a4e5a4535574e515659584958440000000000000000',
  },
};

/**
 * Pinned against a real burn.
 *
 * The `DepositForBurn` ABI here was V1-shaped — it declared a leading
 * `uint64 indexed nonce` that CCTP V2 does not emit. That single extra field
 * changes the event's topic hash, so no log ever matched and every EVM burn was
 * reported as "not a CCTP burn", successful ones included. A unit test written
 * from the same wrong ABI would have agreed with the bug, so the fixture is a
 * receipt taken off Sepolia rather than a hand-built log:
 *
 *   tx 0xce93dc50…c46ca1c9, block 11454876, status 0x1
 *
 * If these topics stop decoding, the ABI has drifted from the deployed
 * contract again — which is exactly the failure this is here to catch.
 */
describe('EvmCctpClient burn parsing (real Sepolia receipt)', () => {
  // The client's own ABI, not a copy of it. A local copy would keep passing
  // while the real one drifted, which is the failure this exists to catch.
  // Parsing directly rather than through parseBurnReceipt keeps the test off
  // the network — the receipt lookup is not what broke.
  const iface = new ethers.Interface(TOKEN_MESSENGER_V2_ABI);

  it('the deployed contract emits the V2 topic, not the V1 one', () => {
    const v1Style = ethers.id(
      'DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32,uint256,uint32,bytes)',
    );

    expect(fixture.depositForBurnLog.topics[0]).toBe(
      iface.getEvent('DepositForBurn')!.topicHash,
    );
    expect(fixture.depositForBurnLog.topics[0]).not.toBe(v1Style);
  });

  it('decodes the burn a customer actually signed', () => {
    const parsed = iface.parseLog({
      topics: [...fixture.depositForBurnLog.topics],
      data: fixture.depositForBurnLog.data,
    });

    expect(parsed).not.toBeNull();
    // 0.01 USDC in 6-decimal subunits — the amount on that testnet burn.
    expect(parsed!.args.amount).toBe(10000n);
    // Domain 27 is Stellar: this burn was headed where we think it was.
    expect(Number(parsed!.args.destinationDomain)).toBe(27);
    expect((parsed!.args.burnToken as string).toLowerCase()).toBe(
      '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    );
    expect(parsed!.args.depositor).toBeDefined();
  });

  it('exposes no nonce, because V2 does not emit one', () => {
    const parsed = iface.parseLog({
      topics: [...fixture.depositForBurnLog.topics],
      data: fixture.depositForBurnLog.data,
    });

    // Reading `.nonce` off a V2 event yields undefined rather than throwing,
    // which is how the old code produced a nonce column full of nothing.
    expect(
      (parsed!.args as unknown as Record<string, unknown>).nonce,
    ).toBeUndefined();
  });
});
