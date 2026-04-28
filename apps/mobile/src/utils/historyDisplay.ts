import { HistoryItemEntity } from '@/databases/entities/historyItem';
import type { HistoryDisplayItem } from '@/types/history';

export const ensureHistoryListItemFromDb = (
  item: HistoryItemEntity,
): HistoryDisplayItem => {
  return {
    ...item,
    historyCustomType: item.history_custom_type,
    historyType: item.history_type,
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

      name: '',
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
