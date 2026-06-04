const mockGetTokenSymbol = jest.fn((token?: { symbol?: string }) => {
  return token?.symbol || '';
});

jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token?: { symbol?: string }) => mockGetTokenSymbol(token),
}));

jest.mock('@/utils/history', () => ({
  fetchHistoryTokenItem: jest.fn(),
  fetchHistoryTokenUUId: jest.fn(
    (tokenId: string, chain: string) => `${chain}:${tokenId}`,
  ),
  getHistoryItemType: jest.fn(),
  isNFTTokenId: jest.fn(),
}));

jest.mock('@/utils/historyDisplay', () => ({
  ensureHistoryListItemFromDb: jest.fn(),
}));

jest.mock('@/databases/entities/historyItem', () => ({}));

jest.mock('@/databases/sync/history', () => ({
  loadTxSaveFromLocalStore: jest.fn(),
  txDonePatchTokenAmountInDb: jest.fn(),
}));

import {
  getApproveTokeName,
  judgeIsSmallUsdTx,
  judgeIsSmallUsdTxInApi,
} from './utils';

const nftTokenId = '1'.repeat(32);
const pinnedQueue = [{ chainId: 'eth', tokenId: 'pinned' }] as any[];

const dbHistoryItem = (patch: Record<string, any> = {}) =>
  ({
    tx_from_address: '0xsender',
    owner_addr: '0xowner',
    chain: 'eth',
    receives: [],
    ...patch,
  } as any);

const apiHistoryItem = (patch: Record<string, any> = {}) =>
  ({
    tx: {
      from_addr: '0xsender',
    },
    address: '0xowner',
    chain: 'eth',
    receives: [],
    ...patch,
  } as any);

describe('transaction history display utils', () => {
  beforeEach(() => {
    mockGetTokenSymbol.mockClear();
  });

  it('labels NFT approvals without depending on token metadata', () => {
    expect(
      getApproveTokeName({
        token_approve: {
          token_id: nftTokenId,
        },
      } as any),
    ).toBe('NFT');
    expect(mockGetTokenSymbol).not.toHaveBeenCalled();
  });

  it('uses token symbol for fungible approvals', () => {
    expect(
      getApproveTokeName({
        token_approve: {
          token_id: 'usdc',
          token: {
            symbol: 'USDC',
          },
        },
      } as any),
    ).toBe('USDC');
    expect(mockGetTokenSymbol).toHaveBeenCalledWith({ symbol: 'USDC' });
  });

  it('does not mark outgoing local DB transactions as small USD', () => {
    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          tx_from_address: '0xOwner',
          owner_addr: '0xowner',
          receives: undefined,
        }),
        pinnedQueue,
      ),
    ).toBe(false);
  });

  it('treats local DB transactions without receives as small', () => {
    expect(judgeIsSmallUsdTx(dbHistoryItem(), pinnedQueue)).toBe(true);
  });

  it('uses only core, verified, or pinned local DB tokens for USD value', () => {
    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          receives: [
            {
              token_id: 'spam',
              amount: '10',
              token: {
                price: 100,
              },
            },
          ],
        }),
        pinnedQueue,
      ),
    ).toBe(true);

    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          receives: [
            {
              token_id: 'verified',
              amount: '0.1',
              token: {
                is_verified: true,
                price: 1,
              },
            },
          ],
        }),
        pinnedQueue,
      ),
    ).toBe(false);

    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          receives: [
            {
              token_id: 'pinned',
              amount: '0.05',
              token: {
                price: 10,
              },
            },
          ],
        }),
        pinnedQueue,
      ),
    ).toBe(false);
  });

  it('handles local DB NFT receives by collection metadata', () => {
    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          receives: [
            {
              token_id: nftTokenId,
              token: {},
            },
          ],
        }),
        pinnedQueue,
      ),
    ).toBe(true);

    expect(
      judgeIsSmallUsdTx(
        dbHistoryItem({
          receives: [
            {
              token_id: nftTokenId,
              token: {
                collection: {
                  name: 'Rabby NFT',
                },
              },
            },
          ],
        }),
        pinnedQueue,
      ),
    ).toBe(false);
  });

  it('does not mark outgoing API transactions or empty API receives as small', () => {
    expect(
      judgeIsSmallUsdTxInApi(
        apiHistoryItem({
          tx: {
            from_addr: '0xOwner',
          },
          address: '0xowner',
        }),
        {},
        pinnedQueue,
      ),
    ).toBe(false);

    expect(judgeIsSmallUsdTxInApi(apiHistoryItem(), {}, pinnedQueue)).toBe(
      false,
    );
  });

  it('uses API token dictionary UUID fallback and pinned token value', () => {
    expect(
      judgeIsSmallUsdTxInApi(
        apiHistoryItem({
          receives: [
            {
              token_id: 'usdc',
              amount: '0.1',
            },
          ],
        }),
        {
          'eth:usdc': {
            is_core: true,
            price: 1,
          },
        } as any,
        pinnedQueue,
      ),
    ).toBe(false);

    expect(
      judgeIsSmallUsdTxInApi(
        apiHistoryItem({
          receives: [
            {
              token_id: 'pinned',
              amount: '0.05',
            },
          ],
        }),
        {
          pinned: {
            price: 10,
          },
        } as any,
        pinnedQueue,
      ),
    ).toBe(false);
  });

  it('does not treat API verified-only tokens as priced core tokens', () => {
    expect(
      judgeIsSmallUsdTxInApi(
        apiHistoryItem({
          receives: [
            {
              token_id: 'verified-only',
              amount: '10',
            },
          ],
        }),
        {
          'verified-only': {
            is_verified: true,
            price: 100,
          },
        } as any,
        pinnedQueue,
      ),
    ).toBe(true);
  });
});
