import BigNumber from 'bignumber.js';

import {
  applyAddressChainDomainUpdates,
  computeChainDistribution,
  computeNftChainAssets,
  computeTokenChainAssets,
  getChangedAddressKeys,
  makeSingleAddressChainInfo,
  updateSingleAddressChainDomain,
} from './singleAddressChainDistribution';

describe('singleAddressChainDistribution', () => {
  it('combines valued chains with zero-value NFT-only chains', () => {
    const nft = computeNftChainAssets([
      { id: 'first', chain: 'matic' },
      { id: 'second', chain: 'matic' },
      { id: '', chain: 'eth' },
    ]);
    const result = computeChainDistribution({
      eth: new BigNumber(75),
      arb: new BigNumber(25),
      ...nft,
    });

    expect(result.chainLength).toBe(3);
    expect(result.top3Chains).toEqual(['eth', 'arb', 'matic']);
    expect(result.chainAssets).toEqual([
      { chain: 'eth', total: 75, percentage: 75 },
      { chain: 'arb', total: 25, percentage: 25 },
      { chain: 'matic', total: 0, percentage: 0 },
    ]);
  });

  it('preserves zero-value chains that only contain non-core tokens', () => {
    const result = computeTokenChainAssets([
      {
        chain: 'eth',
        is_core: false,
        usd_value: 12,
      } as Parameters<typeof computeTokenChainAssets>[0][number],
    ]);

    expect(result.eth.toNumber()).toBe(0);
  });

  it('updates one domain without mutating the previous store snapshot', () => {
    const previous = makeSingleAddressChainInfo();
    const next = updateSingleAddressChainDomain(previous, 'token', {
      eth: new BigNumber(10),
    });

    expect(next).not.toBe(previous);
    expect(previous.token).toEqual({});
    expect(previous.computedResult.chainLength).toBe(0);
    expect(next.computedResult.chainLength).toBe(1);
  });

  it('preserves references when a domain projection is unchanged', () => {
    const initial = updateSingleAddressChainDomain(
      makeSingleAddressChainInfo(),
      'token',
      { eth: new BigNumber(10) },
    );
    const next = updateSingleAddressChainDomain(initial, 'token', {
      eth: new BigNumber(10),
    });

    expect(next).toBe(initial);
  });

  it('reports only changed and removed address rows', () => {
    const stable = [];
    const changed = [];
    expect(
      getChangedAddressKeys(
        { first: stable, second: stable },
        { first: stable, second: changed, third: changed },
      ),
    ).toEqual(['second', 'third']);
    expect(getChangedAddressKeys({ first: stable }, {})).toEqual(['first']);
  });

  it('applies every address and domain in one immutable batch', () => {
    const previous = {};
    const next = applyAddressChainDomainUpdates(previous, [
      {
        address: '0xAAAA',
        domain: 'token',
        chainUnit: { eth: new BigNumber(10) },
      },
      {
        address: '0xBBBB',
        domain: 'nft',
        chainUnit: { matic: new BigNumber(0) },
      },
      {
        address: '0xAAAA',
        domain: 'portfolio',
        chainUnit: { arb: new BigNumber(5) },
      },
    ]);

    expect(previous).toEqual({});
    expect(next['0xaaaa'].computedResult.top3Chains).toEqual(['eth', 'arb']);
    expect(next['0xbbbb'].computedResult.top3Chains).toEqual(['matic']);
    expect(
      applyAddressChainDomainUpdates(next, [
        {
          address: '0xAAAA',
          domain: 'token',
          chainUnit: { eth: new BigNumber(10) },
        },
      ]),
    ).toBe(next);
  });
});
