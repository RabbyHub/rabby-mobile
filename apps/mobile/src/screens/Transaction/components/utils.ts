import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemCateType } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { isString } from 'lodash';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';
import {
  NFTItem,
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { IManageToken } from '@/core/services/preference';
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
    return 'NFT';
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

export const judgeIsSmallUsdTx = (
  item: HistoryItemEntity,
  tokenDict: Record<string, TokenItem>,
  pinedQueue: IManageToken[],
) => {
  const currentTime = new Date().getTime();
  if (item.time_at * 1000 > currentTime - 1000 * 60 * 60) {
    // 1 hour not filter
    return false;
  }

  if (item.tx_from_address.toLowerCase() === item.owner_addr.toLowerCase()) {
    return false;
  }

  const receives = safeParseJSON(item.receives) as {
    amount: number;
    from_addr: string;
    token_id: string;
  }[];
  if (!receives || !receives.length) {
    return false;
  }
  let allUsd = new BigNumber(0);

  for (const i of receives) {
    const token =
      tokenDict[fetchHistoryTokenUUId(i.token_id, item.chain)] ||
      tokenDict[i.token_id];
    const tokenIsNft = i.token_id?.length === 32;
    if (tokenIsNft) {
      // reeives nft
      const nftToken = token as unknown as NFTItem;
      if (!nftToken || !nftToken.collection) {
        return true;
      } else {
        return false;
      }
    }
    const isCore =
      token?.is_core ||
      pinedQueue.find(
        p => p.chainId === item.chain && p.tokenId === i.token_id,
      );
    const price = isCore ? token?.price || 0 : 0; // is not core token price to 0
    const usd = new BigNumber(i.amount).multipliedBy(price || 0);
    allUsd = allUsd.plus(usd);
  }

  if (allUsd.isLessThan(new BigNumber(0.1))) {
    return true;
  }

  return false;
};
