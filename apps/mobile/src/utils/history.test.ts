import type { TxHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import type { TransactionHistoryItem } from '@/core/services/transactionHistory';
import { HistoryItemCateType } from '@/types/history';
import { getHistoryItemType } from './history';

jest.mock('./chain', () => ({
  findChain: () => ({ id: 1 }),
}));

jest.mock('@/constant/gas-account', () => ({
  GAS_ACCOUNT_RECEIVED_ADDRESS: '0xreceived',
  GAS_ACCOUNT_WITHDRAWED_ADDRESS: '0xwithdrawn',
  L2_DEPOSIT_ADDRESS_MAP: {},
}));

const apiHistoryItem = {
  id: '0xhash',
  chain: 'eth',
  cate_id: 'send',
  receives: [],
  sends: [],
} as unknown as TxHistoryItem;

describe('getHistoryItemType', () => {
  it('uses the explicitly supplied local transaction state', () => {
    expect(getHistoryItemType(apiHistoryItem, [])).toBe(
      HistoryItemCateType.UnKnown,
    );

    const transactions = [
      {
        chainId: 1,
        hash: '0xhash',
        isGasDeposit: true,
      },
    ] as TransactionHistoryItem[];

    expect(getHistoryItemType(apiHistoryItem, transactions)).toBe(
      HistoryItemCateType.GAS_DEPOSIT,
    );
  });
});
