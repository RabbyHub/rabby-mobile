import type { TestnetChain } from '@/types/customTestnet';

jest.mock('@/core/utils/reexports', () => {
  const { create } = require('zustand');

  return {
    zCreate: create,
  };
});

import {
  buildCustomTestnetAssetSections,
  getCustomTestnetAssetSections,
  syncCustomTestnetStore,
  useCustomTestnetStore,
} from './customTestnet';

describe('store/customTestnet', () => {
  const makeChain = (id: number): TestnetChain =>
    ({
      id,
      name: `Chain ${id}`,
      nativeTokenSymbol: 'ETH',
      nativeTokenAddress: `custom_${id}`,
      nativeTokenDecimals: 18,
      serverId: `custom_${id}`,
    } as TestnetChain);

  beforeEach(() => {
    useCustomTestnetStore.setState({
      customTestnet: {},
      customTokenList: [],
      revision: 0,
    });
  });

  it('builds native and custom token sections from custom testnet state', () => {
    const chain = makeChain(9001);

    const sections = buildCustomTestnetAssetSections({
      customTestnet: {
        [chain.id]: chain,
      },
      customTokenList: [
        {
          id: '0xtoken',
          chainId: chain.id,
          symbol: 'TEST',
          decimals: 6,
        },
      ],
      ownerAddresses: ['0xabc'],
    });

    expect(sections).toEqual([
      {
        chain,
        ownerAddresses: ['0xabc'],
        tokens: [
          {
            id: 'custom_9001',
            chainId: 9001,
            symbol: 'ETH',
            decimals: 18,
            isNative: true,
          },
          {
            id: '0xtoken',
            chainId: 9001,
            symbol: 'TEST',
            decimals: 6,
          },
        ],
      },
    ]);
  });

  it('returns latest sections after syncing the global store', () => {
    const chain = makeChain(9002);

    syncCustomTestnetStore({
      customTestnet: {
        [chain.id]: chain,
      },
      customTokenList: [],
    });
    expect(getCustomTestnetAssetSections(['0xabc'])).toHaveLength(1);

    syncCustomTestnetStore({
      customTestnet: {},
      customTokenList: [],
    });
    expect(getCustomTestnetAssetSections(['0xabc'])).toEqual([]);
  });
});
