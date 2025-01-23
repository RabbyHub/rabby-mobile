import { strings } from '@/utils/i18n';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemCateType } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { isString } from 'lodash';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';
export function getHistoryItemType(
  data: HistoryDisplayItem,
): HistoryItemCateType {
  if (data.cate_id) {
    switch (data.cate_id) {
      case 'receive':
        return HistoryItemCateType.Recieve;
      case 'send':
        return HistoryItemCateType.Send;
      case 'cancel':
        return HistoryItemCateType.Cancel;
      case 'approve':
        if (!data.token_approve?.value) {
          return HistoryItemCateType.Revoke;
        }

        return HistoryItemCateType.Approve;
      default:
        return HistoryItemCateType.UnKnown;
    }
  } else {
    // todo revoke  bridge  contract
    const tokenList = [...data.receives, ...data.sends];
    const isSwap = data.isLocalSwap; // need filter in swap history
    if (isSwap) {
      return HistoryItemCateType.Swap;
    }

    return HistoryItemCateType.UnKnown;
  }
}

export function getApproveTokeName(data: HistoryDisplayItem): string {
  const tokenId = data.token_approve?.token_id || '';
  const tokenUUID = `${data.chain}_token:${tokenId}`;
  const tokenIsNft = tokenId?.length === 32;
  if (tokenIsNft) {
    return strings('page.nft.title');
  }

  return getTokenSymbol(data.tokenDict[tokenId] || data.tokenDict[tokenUUID]);
}

export const fetchHistoryTokenUUId = (
  token_id: string,
  chain: string,
): string => {
  return `${chain}_token:${token_id}`;
};

export const ensureHistoryListItemFromDb = (item: HistoryItemEntity) => {
  return {
    ...item,
    receives: isString(item.receives) && safeParseJSON(item.receives),
    sends: isString(item.sends) && safeParseJSON(item.sends),
    id: item.txHash,
    tx: {
      id: item.txHash,
      status: item.status,
      from_addr: item.tx_from_address,
      to_addr: item.tx_to_address,
      usd_gas_fee: item.tx_usd_gas_fee,
      eth_gas_fee: item.tx_eth_gas_fee,

      name: '', // no use
      params: [],
      value: 0,
      message: '',
    },
    token_approve: {
      token_id: item.token_approve_id,
      spender: item.token_approve_spender,
      value: item.token_approve_value,
    },
    key: `${item.owner_addr}_${item.chain}_${item.txHash}`,
    address: item.owner_addr,

    cateDict: {}, // no use
    debt_liquidated: null,
  };
};
