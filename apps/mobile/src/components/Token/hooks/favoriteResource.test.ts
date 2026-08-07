import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import type { IManageToken } from '@/core/startupServices/preference';

import {
  createFavoriteTokenCache,
  getScopedPinnedTokens,
  loadFavoriteTokenResource,
  resolveFavoriteTokenOwnerAddress,
} from './favoriteResource';

const makePinnedToken = (tokenId: string, chainId = 'ETH'): IManageToken => ({
  chainId,
  tokenId,
});

const makeToken = (id: string, chain = 'eth'): TokenItem =>
  ({
    amount: 1,
    chain,
    decimals: 18,
    id,
    name: id,
    price: 1,
    symbol: id,
  } as TokenItem);

describe('favorite token resource', () => {
  it('normalizes identities and preserves every pinned token across batches', async () => {
    const pinnedTokens = Array.from({ length: 51 }, (_, index) =>
      makePinnedToken(`0x${index.toString(16).toUpperCase()}`),
    );
    const loadBatch = jest.fn(async (keys: string[]) =>
      keys.map(key => makeToken(key.split(':')[1].toLowerCase())),
    );

    const result = await loadFavoriteTokenResource({
      address: '0xOwner',
      cache: createFavoriteTokenCache(),
      force: false,
      pinnedTokens,
      loadBatch,
    });

    expect(loadBatch).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(51);
    expect(result.data[0].id).toBe('0x0');
    expect(result.data[50].id).toBe('0x32');
  });

  it('does not reuse account-specific token amounts for another owner', async () => {
    const pinnedTokens = [makePinnedToken('0xAAA')];
    const loadBatch = jest.fn(async (_keys: string[], address: string) => [
      {
        ...makeToken('0xaaa'),
        amount: address === '0xFirst' ? 1 : 2,
      },
    ]);

    const first = await loadFavoriteTokenResource({
      address: '0xFirst',
      cache: createFavoriteTokenCache(),
      force: false,
      pinnedTokens,
      loadBatch,
    });
    const second = await loadFavoriteTokenResource({
      address: '0xSecond',
      cache: first.cache,
      force: false,
      pinnedTokens,
      loadBatch,
    });

    expect(loadBatch).toHaveBeenCalledTimes(2);
    expect(first.data[0].amount).toBe(1);
    expect(second.data[0].amount).toBe(2);
    expect(first.cache.ownerKey).toBe('0xfirst');
    expect(second.cache.ownerKey).toBe('0xsecond');
  });

  it('scopes and deduplicates pinned tokens before loading', () => {
    const scoped = getScopedPinnedTokens(
      [
        makePinnedToken('0xAAA'),
        makePinnedToken('0xaaa'),
        makePinnedToken('0xBBB', 'ARB'),
      ],
      'eth',
    );

    expect(scoped).toEqual([makePinnedToken('0xAAA')]);
  });

  it('keeps the screen account as favorite owner after clearing the list account filter', () => {
    expect(resolveFavoriteTokenOwnerAddress(undefined, '0xScreenAccount')).toBe(
      '0xScreenAccount',
    );
    expect(
      resolveFavoriteTokenOwnerAddress('0xFilteredAccount', '0xScreenAccount'),
    ).toBe('0xFilteredAccount');
  });
});
