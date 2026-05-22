const mockGetList = jest.fn();

jest.mock('../services/shared', () => ({
  transactionHistoryService: {
    getList: (...args: unknown[]) => mockGetList(...args),
  },
  transactionWatcherService: {
    removeLocalPendingTx: jest.fn(),
    clearPendingTx: jest.fn(),
  },
  transactionBroadcastWatcherService: {
    removeLocalPendingTx: jest.fn(),
    clearPendingTx: jest.fn(),
  },
}));

jest.mock('./provider', () => ({
  requestETHRpc: jest.fn(),
}));

jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
}));

jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: jest.fn((a: string, b: string) => {
    return a.toLowerCase() === b.toLowerCase();
  }),
}));

import { apisTransactionHistory } from './transactionHistory';

describe('apisTransactionHistory.getPendingTxs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns same-chain pending txs sorted by nonce for pre-exec', async () => {
    const pending = (chainId: number, nonce: number) => ({
      chainId,
      nonce,
      createdAt: nonce * 1000,
      txs: [
        {
          rawTx: {
            from: '0xfrom',
            to: `0xto${nonce}`,
            chainId,
            data: `0x${nonce}`,
            nonce: `0x${nonce}`,
            value: '0x0',
            gasPrice: `0x${nonce}`,
            gas: '0x5208',
          },
        },
      ],
    });

    mockGetList.mockReturnValue({
      pendings: [pending(1, 3), pending(1, 1), pending(2, 2), pending(1, 2)],
    });

    const txs = await apisTransactionHistory.getPendingTxs({
      recommendNonce: '0x4',
      address: '0xfrom',
      chainId: 1,
    });

    expect(txs.map(tx => tx.nonce)).toEqual(['0x1', '0x2', '0x3']);
    expect(txs.every(tx => tx.chainId === 1)).toBe(true);
  });
});
