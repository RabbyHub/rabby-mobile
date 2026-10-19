import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { CHAINS_ENUM } from '@/constant/chains';

import {
  getInitialDisplayToken,
  getInitialSendTokenDisplaySnapshot,
} from './initialDisplayToken';

const mockChains = [
  {
    enum: 'ETH',
    id: 1,
    serverId: 'eth',
    nativeTokenAddress: 'eth',
    nativeTokenSymbol: 'ETH',
  },
  {
    enum: 'BSC',
    id: 56,
    serverId: 'bsc',
    nativeTokenAddress: 'bsc',
    nativeTokenSymbol: 'BNB',
  },
];
let mockLastTokens: Record<string, TokenItem> | undefined;
const mockGetLastTimeSendTokenSnapshot = jest.fn();
const mockGetOrderedChainListSnapshot = jest.fn();

jest.mock('@/utils/chain', () => ({
  findChainByServerID: (id: string) =>
    mockChains.find(chain => chain.serverId === id) || null,
  findChainByEnum: (chainEnum: string) =>
    mockChains.find(chain => chain.enum === chainEnum) || null,
  findChainByID: (id: number) =>
    mockChains.find(chain => chain.id === id) || null,
  makeTokenFromChain: (chain: (typeof mockChains)[number]) => ({
    chain: chain.serverId,
    id: chain.nativeTokenAddress,
    symbol: chain.nativeTokenSymbol,
    decimals: 18,
  }),
}));
jest.mock('@/utils/common', () => ({
  lowcaseSame: (left: string, right: string) =>
    left.toLowerCase() === right.toLowerCase(),
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getLastTimeSendTokenSnapshot: (...args: unknown[]) =>
    mockGetLastTimeSendTokenSnapshot(...args),
}));
jest.mock('@/hooks/accountChainBalance', () => ({
  getOrderedChainListSnapshot: (...args: unknown[]) =>
    mockGetOrderedChainListSnapshot(...args),
}));

beforeEach(() => {
  mockLastTokens = {};
  mockGetLastTimeSendTokenSnapshot.mockReset().mockImplementation(address => ({
    ready: mockLastTokens !== undefined,
    token: mockLastTokens?.[address.toLowerCase()] ?? null,
  }));
  mockGetOrderedChainListSnapshot
    .mockReset()
    .mockReturnValue({ firstChain: mockChains[0] });
});

describe('getInitialDisplayToken', () => {
  it('uses a persisted token snapshot when its display identity is complete', () => {
    const token = {
      chain: 'eth',
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: 'USDC',
    } as TokenItem;

    expect(getInitialDisplayToken(token)).toBe(token);
  });

  it('waits for token details when a route provides only chain and id', () => {
    const token = {
      chain: 'eth',
      id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: '',
      display_symbol: '',
      optimized_symbol: '',
    } as TokenItem;

    expect(getInitialDisplayToken(token)).toBeNull();
  });
});

// Unit contract: real selection helper, mocked public preference/chain snapshots.
// This does not prove native first-paint timing or async Send initialization.
describe('getInitialSendTokenDisplaySnapshot', () => {
  const addressA = '0x00000000000000000000000000000000000000aa';
  const addressB = '0x00000000000000000000000000000000000000bb';
  const fallbackToken = {
    chain: 'eth',
    id: 'eth',
    symbol: 'ETH',
  } as TokenItem;
  const persistedToken = {
    chain: 'eth',
    id: '0x0000000000000000000000000000000000000001',
    symbol: 'TEST',
  } as TokenItem;
  const select = (
    params?: Parameters<typeof getInitialSendTokenDisplaySnapshot>[0]['params'],
    accountAddress = addressA,
  ) =>
    getInitialSendTokenDisplaySnapshot({
      accountAddress,
      params,
      fallbackToken,
    });

  it('returns the first ordered native token synchronously when preferences are ready', () => {
    mockGetOrderedChainListSnapshot.mockReturnValue({
      firstChain: mockChains[1],
    });
    const token = select();
    expect(token).not.toBeInstanceOf(Promise);
    expect(token).toEqual({
      chain: 'bsc',
      id: 'bsc',
      symbol: 'BNB',
      decimals: 18,
    });
    expect(mockGetLastTimeSendTokenSnapshot).toHaveBeenCalledWith(addressA);
    expect(mockGetOrderedChainListSnapshot).toHaveBeenCalledWith({
      address: addressA,
    });
  });

  it('distinguishes an unloaded preference snapshot from a ready empty map', () => {
    mockLastTokens = undefined;
    expect(select()).toBeNull();
    expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
    mockLastTokens = {};
    expect(select()).toMatchObject({ chain: 'eth', id: 'eth', symbol: 'ETH' });
  });

  it('uses the safe native chain before explicit route or remembered selections, without waiting for preferences', () => {
    mockLastTokens = undefined;
    expect(
      select({
        safeInfo: { chainId: 56 },
        chainEnum: 'ETH' as CHAINS_ENUM,
        tokenId: 'eth',
      }),
    ).toMatchObject({ chain: 'bsc', id: 'bsc', symbol: 'BNB' });
    expect(mockGetLastTimeSendTokenSnapshot).not.toHaveBeenCalled();
    expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
  });

  it('gives an explicit native token route priority and normalizes native token identity', () => {
    mockLastTokens = { [addressA]: persistedToken };
    expect(
      select({ chainEnum: 'BSC' as CHAINS_ENUM, tokenId: 'BSC' }),
    ).toMatchObject({ chain: 'bsc', id: 'bsc', symbol: 'BNB' });
    expect(mockGetLastTimeSendTokenSnapshot).not.toHaveBeenCalled();
    expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    { safeInfo: { chainId: 999999 } },
    { chainEnum: 'UNKNOWN' as CHAINS_ENUM, tokenId: 'eth' },
    { chainEnum: 'ETH' as CHAINS_ENUM, tokenId: persistedToken.id },
  ])(
    'does not replace an unresolved explicit route with the remembered token: %j',
    params => {
      mockLastTokens = { [addressA]: persistedToken };
      expect(select(params)).toBeNull();
      expect(mockGetLastTimeSendTokenSnapshot).not.toHaveBeenCalled();
      expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
    },
  );

  it('uses this account remembered token before ordered chains, including case-insensitive address lookup', () => {
    const lastTokens = Object.freeze({
      [addressA]: Object.freeze(persistedToken),
    });
    mockLastTokens = lastTokens;
    expect(select(undefined, addressA.toUpperCase())).toBe(persistedToken);
    expect(mockGetLastTimeSendTokenSnapshot).toHaveBeenCalledWith(
      addressA.toUpperCase(),
    );
    expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
    expect(lastTokens[addressA]).toBe(persistedToken);
  });

  it('isolates selections across successive account calls instead of reusing the previous account token', () => {
    const tokenB = { ...persistedToken, id: '0x02', symbol: 'OTHER' };
    mockLastTokens = {
      [addressA]: persistedToken,
      [addressB]: tokenB,
    };
    expect(select()).toBe(persistedToken);
    expect(select(undefined, addressB)).toBe(tokenB);
    mockLastTokens = { [addressA]: persistedToken };
    expect(select(undefined, addressB)).toMatchObject({
      chain: 'eth',
      id: 'eth',
      symbol: 'ETH',
    });
    expect(mockGetOrderedChainListSnapshot).toHaveBeenCalledWith({
      address: addressB,
    });
  });

  it.each([
    { ...persistedToken, symbol: '', display_symbol: '', optimized_symbol: '' },
    { ...persistedToken, chain: 'removed-custom-network' },
  ])(
    'waits for async initialization when remembered metadata is insufficient: %j',
    token => {
      mockLastTokens = { [addressA]: token };
      expect(select()).toBeNull();
      expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
    },
  );

  it('fills native display identity from known chain metadata even if the remembered symbol is missing', () => {
    mockLastTokens = {
      [addressA]: { chain: 'bsc', id: 'BSC', symbol: '' } as TokenItem,
    };
    expect(select()).toMatchObject({ chain: 'bsc', id: 'bsc', symbol: 'BNB' });
  });

  it('uses the fallback only when preferences are ready and no remembered or ordered token exists', () => {
    mockGetOrderedChainListSnapshot.mockReturnValue({ firstChain: undefined });
    expect(select()).toMatchObject({ chain: 'eth', id: 'eth', symbol: 'ETH' });
    expect(
      getInitialSendTokenDisplaySnapshot({
        accountAddress: addressA,
        fallbackToken: { ...persistedToken, symbol: '' },
      }),
    ).toBeNull();
  });

  it.each([
    { toAddress: addressB },
    { toAddress: addressB, chainEnum: 'ETH' as CHAINS_ENUM, tokenId: 'eth' },
    { toAddress: addressB, safeInfo: { chainId: 56 } },
  ])(
    'waits for recipient recommendation instead of showing a potentially wrong initial token: %j',
    params => {
      expect(select(params)).toBeNull();
      expect(mockGetLastTimeSendTokenSnapshot).not.toHaveBeenCalled();
      expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
    },
  );

  it('does not reuse fallback or route state without a current account', () => {
    expect(select({ safeInfo: { chainId: 56 } }, '')).toBeNull();
    expect(mockGetLastTimeSendTokenSnapshot).not.toHaveBeenCalled();
    expect(mockGetOrderedChainListSnapshot).not.toHaveBeenCalled();
  });
});
