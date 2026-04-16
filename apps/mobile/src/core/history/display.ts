import type {
  NFTItem,
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';

import type { KeyringAccountWithAlias } from '@/core/account/utils';
import type { ProjectItemType } from '@/databases/entities/historyItem';

import type { CUSTOM_HISTORY_TITLE_TYPE, HistoryItemCateType } from './types';

export interface HistoryDisplayItem extends Omit<TxHistoryItem, 'tx'> {
  tx:
    | (TxHistoryItem['tx'] & {
        id?: string;
      })
    | null;
  receives: {
    amount: number;
    from_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  sends: {
    amount: number;
    to_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  time_at: number;
  token_approve: {
    spender: string;
    token_id: string;
    value: number;
    price?: number;
    token?: TokenItem;
  } | null;
  address: string;
  project_item: ProjectItemType | null;
  key: string;
  isSmallUsdTx?: boolean;
  cateDict?: Record<string, string>;
  account?: KeyringAccountWithAlias;
  isShowSuccess?: boolean;
  historyType: HistoryItemCateType;
  historyCustomType?: CUSTOM_HISTORY_TITLE_TYPE;
}

export type TokenChangeDataItem = {
  amount: number;
  token?: TokenItem | NFTItem;
  token_id: string;
  price?: number;
  type: 'send' | 'receive' | 'approve';
};

export const ensureHistoryListItemFromDb = (item: {
  history_custom_type?: CUSTOM_HISTORY_TITLE_TYPE;
  history_type: HistoryItemCateType;
  is_scam: boolean;
  receives: HistoryDisplayItem['receives'];
  sends: HistoryDisplayItem['sends'];
  txHash: string;
  status: number;
  tx_from_address: string;
  tx_to_address: string;
  tx_usd_gas_fee: number;
  tx_eth_gas_fee: number;
  tx_name: string;
  token_approve_id: string;
  token_approve_spender: string;
  token_approve_value: number;
  token_approve_item?: TokenItem;
  project_id?: string | null;
  project_item?: ProjectItemType | null;
  _db_id: string;
  owner_addr: string;
  is_small_tx?: boolean;
  cate_id: string | null;
  other_addr: string;
  chain: string;
  time_at: number;
}): HistoryDisplayItem => {
  return {
    ...item,
    cate_id: item.cate_id,
    historyCustomType: item.history_custom_type,
    historyType: item.history_type,
    is_scam: item.is_scam,
    other_addr: item.other_addr,
    project_id: item.project_id ?? item.project_item?.id ?? null,
    receives: item.receives,
    sends: item.sends,
    id: item.txHash,
    tx: {
      id: item.txHash,
      status: item.status,
      from_addr: item.tx_from_address,
      to_addr: item.tx_to_address,
      usd_gas_fee: item.tx_usd_gas_fee,
      eth_gas_fee: item.tx_eth_gas_fee,
      name: item.tx_name,
      params: [],
      value: 0,
      message: '',
    },
    token_approve: {
      token_id: item.token_approve_id,
      spender: item.token_approve_spender,
      value: item.token_approve_value,
      token: item.token_approve_item,
    },
    project_item: item.project_item ?? null,
    key: item._db_id,
    address: item.owner_addr,
    isSmallUsdTx: item.is_small_tx,
    cateDict: {},
    debt_liquidated: null,
  };
};
