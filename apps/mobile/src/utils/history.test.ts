jest.mock('@debank/common', () => ({
  CHAINS_ENUM: {
    ARBITRUM: 'arb',
    AVAX: 'avax',
    BASE: 'base',
    BSC: 'bsc',
    ETH: 'eth',
    OP: 'op',
    POLYGON: 'polygon',
  },
}));

import {
  GAS_ACCOUNT_RECEIVED_ADDRESS,
  GAS_ACCOUNT_WITHDRAWED_ADDRESS,
  L2_DEPOSIT_ADDRESS_MAP,
} from '@/constant/gas-account';
import { HistoryItemCateType } from '@/types/history';
import type {
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import {
  fetchHistoryTokenItem,
  fetchHistoryTokenUUId,
  getHistoryItemType,
  isNFTTokenId,
} from './history';

const erc20 = (token_id = '0xtoken') => ({
  token_id,
});

const nftToken = () => ({
  token_id: '12345678901234567890123456789012',
});

const historyItem = (overrides: Partial<TxHistoryItem>): TxHistoryItem =>
  ({
    cate_id: 'transfer',
    receives: [],
    sends: [],
    other_addr: '0x0000000000000000000000000000000000000000',
    tx: {
      from_addr: '0x1111111111111111111111111111111111111111',
      to_addr: '0x2222222222222222222222222222222222222222',
    },
    ...overrides,
  } as TxHistoryItem);

describe('history utils', () => {
  it('detects NFT token ids by the API id length convention', () => {
    expect(isNFTTokenId('12345678901234567890123456789012')).toBe(true);
    expect(isNFTTokenId('0x1234')).toBe(false);
  });

  it('classifies approval, revoke, and cancel history before transfer shapes', () => {
    expect(
      getHistoryItemType(
        historyItem({
          cate_id: 'approve',
          token_approve: { value: '100' },
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.Approve);

    expect(
      getHistoryItemType(
        historyItem({
          cate_id: 'approve',
          token_approve: { value: '' },
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.Revoke);

    expect(getHistoryItemType(historyItem({ cate_id: 'cancel' }))).toBe(
      HistoryItemCateType.Cancel,
    );
  });

  it('classifies swaps after excluding NFT-only token ids', () => {
    expect(
      getHistoryItemType(
        historyItem({
          receives: [nftToken(), erc20('0xreceive')],
          sends: [erc20('0xsend')],
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.Swap);
  });

  it('classifies receives including gas-account withdraw and received markers', () => {
    expect(
      getHistoryItemType(
        historyItem({
          receives: [erc20()],
          tx: { from_addr: GAS_ACCOUNT_WITHDRAWED_ADDRESS.toUpperCase() },
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.GAS_WITHDRAW);

    expect(
      getHistoryItemType(
        historyItem({
          receives: [erc20()],
          tx: { from_addr: GAS_ACCOUNT_RECEIVED_ADDRESS.toUpperCase() },
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.GAS_RECEIVED);

    expect(
      getHistoryItemType(
        historyItem({
          receives: [erc20()],
        }),
      ),
    ).toBe(HistoryItemCateType.Recieve);
  });

  it('classifies sends including L2 gas deposits', () => {
    expect(
      getHistoryItemType(
        historyItem({
          sends: [erc20()],
          other_addr: L2_DEPOSIT_ADDRESS_MAP.eth,
        }),
      ),
    ).toBe(HistoryItemCateType.GAS_DEPOSIT);

    expect(
      getHistoryItemType(
        historyItem({
          sends: [erc20()],
          other_addr: '0x3333333333333333333333333333333333333333',
        }),
      ),
    ).toBe(HistoryItemCateType.Send);
  });

  it('falls back to interaction for unsupported transfer shapes', () => {
    expect(
      getHistoryItemType(
        historyItem({
          receives: [erc20('0xreceive1'), erc20('0xreceive2')],
          sends: [],
        } as Partial<TxHistoryItem>),
      ),
    ).toBe(HistoryItemCateType.UnKnown);
  });

  it('builds and resolves history token dictionary keys with legacy fallback', () => {
    const token = { id: '0xabc', chain: 'eth', symbol: 'ABC' } as TokenItem;
    const legacyToken = {
      id: '0xlegacy',
      chain: 'eth',
      symbol: 'LEGACY',
    } as TokenItem;

    expect(fetchHistoryTokenUUId('0xabc', 'eth')).toBe('eth_token:0xabc');
    expect(
      fetchHistoryTokenItem('0xabc', 'eth', {
        'eth_token:0xabc': token,
      }),
    ).toBe(token);
    expect(
      fetchHistoryTokenItem('0xlegacy', 'eth', {
        '0xlegacy': legacyToken,
      }),
    ).toBe(legacyToken);
    expect(fetchHistoryTokenItem('0xmissing', 'eth', {})).toEqual({});
  });
});
