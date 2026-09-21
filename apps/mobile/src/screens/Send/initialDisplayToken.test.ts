import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { getInitialDisplayToken } from './initialDisplayToken';

jest.mock('@/utils/chain', () => ({
  findChainByServerID: () => null,
  makeTokenFromChain: jest.fn(),
}));
jest.mock('@/utils/common', () => ({
  lowcaseSame: (left: string, right: string) =>
    left.toLowerCase() === right.toLowerCase(),
}));

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
