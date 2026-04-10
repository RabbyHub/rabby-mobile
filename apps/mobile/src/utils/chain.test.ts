const mainnetChains = [
  {
    enum: 'ETH',
    id: 1,
    serverId: 'eth',
    hex: '0x1',
    network: '1',
    isTestnet: false,
    logo: 'eth-logo',
    whiteLogo: 'eth-white',
    logo_url: 'eth-logo-url',
    name: 'Ethereum',
    nativeTokenAddress: '0xeeee',
    nativeTokenDecimals: 18,
    nativeTokenLogo: 'eth-native-logo',
    nativeTokenSymbol: 'ETH',
    severity: 0,
  },
  {
    enum: 'BSC',
    id: 56,
    serverId: 'bsc',
    hex: '0x38',
    network: '56',
    isTestnet: false,
    logo: 'bsc-logo',
    whiteLogo: 'bsc-white',
    logo_url: 'bsc-logo-url',
    name: 'BNB Chain',
    nativeTokenAddress: '0xbbbb',
    nativeTokenDecimals: 18,
    nativeTokenLogo: 'bnb-native-logo',
    nativeTokenSymbol: 'BNB',
    severity: 1,
  },
] as const;

const testnetChains = [
  {
    enum: 'GOERLI',
    id: 5,
    serverId: 'goerli',
    hex: '0x5',
    network: '5',
    isTestnet: true,
    logo: 'goerli-logo',
    whiteLogo: 'goerli-white',
    logo_url: 'goerli-logo-url',
    name: 'Goerli',
    nativeTokenAddress: '0xgggg',
    nativeTokenDecimals: 18,
    nativeTokenLogo: 'goerli-native-logo',
    nativeTokenSymbol: 'gETH',
    severity: 0,
  },
  {
    enum: 'CUSTOM_TEST',
    id: 123,
    serverId: 'custom-test',
    hex: '0x7b',
    network: '123',
    isTestnet: true,
    logo: 'custom-logo',
    whiteLogo: 'custom-white',
    logo_url: 'custom-logo-url',
    name: 'Custom Testnet',
    nativeTokenAddress: '0xcccc',
    nativeTokenDecimals: 18,
    nativeTokenLogo: 'custom-native-logo',
    nativeTokenSymbol: 'CT',
    severity: 2,
  },
] as const;

function loadChainModule() {
  jest.resetModules();

  jest.doMock('@/constant/chains', () => ({
    CHAINS_ENUM: {
      ETH: 'ETH',
      BSC: 'BSC',
      GOERLI: 'GOERLI',
      CUSTOM_TEST: 'CUSTOM_TEST',
    },
    getChainList: (tab: 'mainnet' | 'testnet') =>
      tab === 'mainnet' ? [...mainnetChains] : [...testnetChains],
  }));

  return require('./chain') as typeof import('./chain');
}

describe('chain utils', () => {
  it('finds chains by enum, id, serverId, hex, network, and CUSTOM_ prefix', () => {
    const { findChain, makeChainServerIdSet } = loadChainModule();

    expect(findChain({ enum: 'ETH' })?.serverId).toBe('eth');
    expect(findChain({ id: 56 })?.enum).toBe('BSC');
    expect(findChain({ serverId: 'goerli' })?.enum).toBe('GOERLI');
    expect(findChain({ hex: '0x1' })?.enum).toBe('ETH');
    expect(findChain({ networkId: '56' })?.enum).toBe('BSC');
    expect(findChain({ enum: 'CUSTOM_123' })?.serverId).toBe('custom-test');

    expect(Array.from(makeChainServerIdSet())).toEqual([
      'eth',
      'bsc',
      'goerli',
      'custom-test',
    ]);
  });

  it('keeps the current fallback and validation behavior around chain enums', () => {
    const {
      ensureChainHashValid,
      ensureChainListValid,
      filterChainEnum,
      findChainByEnum,
    } = loadChainModule();

    expect(findChainByEnum(undefined, { fallback: true })?.enum).toBe('ETH');
    expect(findChainByEnum('NOT_FOUND', { fallback: 'BSC' as any })?.enum).toBe(
      'BSC',
    );
    expect(filterChainEnum('GOERLI' as any)).toBe('GOERLI');
    expect(filterChainEnum('NOT_FOUND' as any)).toBeNull();
    expect(
      ensureChainHashValid({
        ETH: 1,
        UNKNOWN: 2,
      } as any),
    ).toEqual({
      ETH: 1,
    });
    expect(ensureChainListValid(['ETH', 'UNKNOWN', 'GOERLI'] as any)).toEqual([
      'ETH',
      'GOERLI',
    ]);
  });

  it('formats and classifies chains using current metadata lookups', () => {
    const {
      findChainByID,
      findChainByServerID,
      formatChain,
      formatChainToDisplay,
      getChain,
      isTestnet,
      isTestnetChainId,
      makeTokenFromChain,
    } = loadChainModule();

    expect(findChainByID(1)?.enum).toBe('ETH');
    expect(findChainByServerID('goerli')?.enum).toBe('GOERLI');
    expect(isTestnet('goerli')).toBe(true);
    expect(isTestnet('eth')).toBe(false);
    expect(isTestnetChainId(5)).toBe(true);
    expect(isTestnetChainId('1')).toBe(false);
    expect(getChain('bsc')?.enum).toBe('BSC');

    expect(
      formatChainToDisplay({
        community_id: 1,
        logo_url: 'fallback-logo',
      } as any),
    ).toMatchObject({
      logo: 'eth-logo',
      whiteLogo: 'eth-white',
    });

    expect(
      formatChain({
        community_id: 999,
        logo_url: 'fallback-logo',
      } as any),
    ).toMatchObject({
      logo: 'fallback-logo',
      whiteLogo: undefined,
    });

    expect(makeTokenFromChain(mainnetChains[0] as any)).toMatchObject({
      id: '0xeeee',
      symbol: 'ETH',
      chain: 'eth',
      is_core: true,
      is_verified: true,
      is_wallet: true,
    });
  });

  it('sorts and searches chain items according to support, balance, and pinned state', () => {
    const { searchChains, sortChainItems, varyAndSortChainItems } =
      loadChainModule();

    expect(
      sortChainItems([...mainnetChains] as any, {
        cachedChainBalances: {
          eth: { usd_value: 1 } as any,
          bsc: { usd_value: 5 } as any,
        },
      }).map(item => item.enum),
    ).toEqual(['BSC', 'ETH']);

    expect(
      sortChainItems([...mainnetChains] as any, {
        supportChains: ['ETH'] as any,
        cachedChainBalances: {
          eth: { usd_value: 1 } as any,
          bsc: { usd_value: 5 } as any,
        },
      }).map(item => item.enum),
    ).toEqual(['ETH', 'BSC']);

    expect(
      searchChains({
        list: [...mainnetChains] as any,
        pinned: ['BSC'],
        searchKeyword: 'b',
      }).map(item => item.enum),
    ).toEqual(['BSC']);

    const varied = varyAndSortChainItems({
      pinned: ['ETH'],
      supportChains: ['ETH', 'BSC'],
      matteredChainBalances: {
        eth: { usd_value: 10 } as any,
        bsc: { usd_value: 5 } as any,
      },
      mainnetList: [...mainnetChains] as any,
      testnetList: [...testnetChains] as any,
    });

    expect(varied.matteredList.map(item => item.enum)).toEqual(['ETH', 'BSC']);
    expect(varied.unmatteredList).toEqual([]);
  });

  it('derives the top three core-token chains by aggregated usd value', () => {
    const { getTop3Chains } = loadChainModule();

    expect(
      getTop3Chains([
        {
          chain: 'eth',
          is_core: true,
          usd_value: 2,
        },
        {
          chain: 'eth',
          is_core: true,
          usd_value: 3,
        },
        {
          chain: 'bsc',
          is_core: true,
          usd_value: 4,
        },
        {
          chain: 'goerli',
          is_core: false,
          usd_value: 999,
        },
        {
          chain: 'custom-test',
          is_core: true,
          usd_value: 1,
        },
      ] as any),
    ).toEqual(['eth', 'bsc', 'custom-test']);
  });
});
