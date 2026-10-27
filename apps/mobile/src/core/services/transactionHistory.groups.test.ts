jest.mock('nanoid', () => ({ nanoid: () => 'id' }));
jest.mock('../request', () => ({ openapi: {}, testOpenapi: {} }));
jest.mock('@/databases/sync/utils', () => ({ updateExpiredTime: jest.fn() }));
jest.mock('@/utils/stats', () => ({ stats: { report: jest.fn() } }));
jest.mock('@/utils/token', () => ({
  customTestnetTokenToTokenItem: jest.fn(),
  getTokenSymbol: jest.fn(),
}));
jest.mock('./serviceRegistry', () => ({ callCoreService: jest.fn() }));
jest.mock('@/databases/sync/history', () => ({}));
jest.mock('../utils/tx', () => ({
  findMaxGasTx: jest.fn(),
  getRpcTxReceipt: jest.fn(),
}));
jest.mock('@rabby-wallet/rabby-action', () => ({}));
jest.mock('@/utils/events', () => ({
  EVENTS: {},
  eventBus: { emit: jest.fn() },
}));

jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(({ id }: { id: number }) => (id === 999 ? null : { id })),
}));

import {
  TransactionHistoryService,
  type TransactionHistoryItem,
} from './transactionHistory';

const tx = (
  address: string,
  chainId: number,
  nonce: number,
  hash: string,
): TransactionHistoryItem =>
  ({
    address,
    chainId,
    nonce,
    hash,
    createdAt: nonce,
    rawTx: { gasPrice: '0x1', nonce: `0x${nonce.toString(16)}` },
  } as unknown as TransactionHistoryItem);

describe('TransactionHistoryService.getTransactionGroups', () => {
  const setTransactions = (
    service: TransactionHistoryService,
    transactions: TransactionHistoryItem[],
  ) => {
    (
      service as unknown as {
        mutateStore: (
          recipe: (draft: { transactions: TransactionHistoryItem[] }) => void,
        ) => void;
      }
    ).mutateStore(draft => {
      draft.transactions = transactions;
    });
  };

  it('groups matched txs by address, chain and nonce in first-seen order', () => {
    const service = new TransactionHistoryService();
    setTransactions(service, [
      tx('0xAbC', 1, 1, 'a1'),
      tx('0xother', 1, 1, 'o1'),
      tx('0xabc', 56, 1, 'b1'),
      tx('0xABC', 1, 1, 'a2'),
      tx('0xabc', 999, 2, 'unknown-chain'),
      tx('0xabc', 1, 2, 'c1'),
    ]);

    const groups = service.getTransactionGroups({ address: '0xabc' });

    expect(groups.map(g => g.txs.map(item => item.hash))).toEqual([
      ['a1', 'a2'],
      ['b1'],
      ['c1'],
    ]);
  });

  it('keeps strict matching for malformed chainId and nonce values', () => {
    const service = new TransactionHistoryService();
    setTransactions(service, [
      tx('0xabc', 1, 1, 'number-chain'),
      tx('0xabc', '1' as unknown as number, 1, 'string-chain-1'),
      tx('0xabc', '1' as unknown as number, 1, 'string-chain-2'),
      tx('0xabc', 1, NaN, 'nan-1'),
      tx('0xabc', 1, NaN, 'nan-2'),
    ]);

    const groups = service.getTransactionGroups({ address: '0xabc' });

    expect(groups.map(g => g.txs.map(item => item.hash))).toEqual([
      ['number-chain'],
      ['string-chain-1', 'string-chain-2'],
      ['nan-1'],
      ['nan-2'],
    ]);
  });

  it('returns copies that do not leak mutations into the store', () => {
    const service = new TransactionHistoryService();
    setTransactions(service, [tx('0xabc', 1, 1, 'a1')]);

    const [group] = service.getTransactionGroups({ address: '0xabc' });
    group.txs[0].hash = 'mutated';
    group.txs.push(tx('0xabc', 1, 1, 'pushed'));

    expect(
      service
        .getTransactionGroups({ address: '0xabc' })[0]
        .txs.map(item => item.hash),
    ).toEqual(['a1']);
  });
});
