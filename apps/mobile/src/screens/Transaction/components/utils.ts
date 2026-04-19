import type { HistoryDisplayItem } from '@/core/history/display';
import { getTokenSymbol } from '@/utils/token';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import {
  NFTItem,
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import type { IManageToken } from '@/core/services/preference';
import { duplicatelyStringifiedAppJsonStore } from '@/core/storage/mmkv';
import { HistoryItemCateType } from './type';
import {
  GAS_ACCOUNT_RECEIVED_ADDRESS,
  GAS_ACCOUNT_WITHDRAWED_ADDRESS,
  L2_DEPOSIT_ADDRESS_MAP,
} from '@/constant/gas-account';
import { ensureHistoryListItemFromDb } from '@/core/history/display';
import {
  fetchHistoryTokenItem,
  fetchHistoryTokenUUId,
  isNFTTokenId,
} from '@/core/history/tokenUtils';

export { ensureHistoryListItemFromDb } from '@/core/history/display';
export {
  fetchHistoryTokenItem,
  fetchHistoryTokenUUId,
  isNFTTokenId,
} from '@/core/history/tokenUtils';

export function getApproveTokeName(data: HistoryDisplayItem): string {
  const tokenId = data.token_approve?.token_id || '';
  const tokenIsNft = tokenId?.length === 32;
  if (tokenIsNft) {
    return 'NFT';
  }

  return getTokenSymbol(data.token_approve?.token);
}

export function getHistoryItemType(data: TxHistoryItem): HistoryItemCateType {
  if (data.cate_id === 'approve') {
    if (!data.token_approve?.value) {
      return HistoryItemCateType.Revoke;
    } else {
      return HistoryItemCateType.Approve;
    }
  }

  if (data.cate_id === 'cancel') {
    return HistoryItemCateType.Cancel;
  }

  const receives = data.receives;
  const sends = data.sends;
  if (
    receives?.filter(item => !isNFTTokenId(item.token_id)).length === 1 &&
    sends?.filter(item => !isNFTTokenId(item.token_id)).length === 1
  ) {
    return HistoryItemCateType.Swap;
  }

  if (receives?.length === 1 && sends?.length === 0) {
    if (data.tx?.from_addr.toLowerCase() === GAS_ACCOUNT_WITHDRAWED_ADDRESS) {
      return HistoryItemCateType.GAS_WITHDRAW;
    }

    if (data.tx?.from_addr.toLowerCase() === GAS_ACCOUNT_RECEIVED_ADDRESS) {
      return HistoryItemCateType.GAS_RECEIVED;
    }

    return HistoryItemCateType.Recieve;
  }

  if (receives?.length === 0 && sends?.length === 1) {
    if (
      Object.values(L2_DEPOSIT_ADDRESS_MAP).includes(
        data.other_addr.toLowerCase() || '',
      )
    ) {
      return HistoryItemCateType.GAS_DEPOSIT;
    }

    return HistoryItemCateType.Send;
  }

  return HistoryItemCateType.UnKnown;
}

export const judgeIsSmallUsdTx = (
  item: HistoryItemEntity,
  pinedQueue: IManageToken[],
) => {
  if (item.tx_from_address.toLowerCase() === item.owner_addr.toLowerCase()) {
    return false;
  }

  const receives = item.receives;
  if (!receives || !receives.length) {
    return true;
  }
  let allUsd = new BigNumber(0);

  for (const i of receives) {
    const token = i.token;
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
      token?.is_verified ||
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

export const judgeIsSmallUsdTxInApi = (
  item: HistoryDisplayItem,
  tokenDict: Record<string, TokenItem>,
  pinedQueue: IManageToken[],
) => {
  if (item.tx?.from_addr.toLowerCase() === item.address.toLowerCase()) {
    return false;
  }

  const receives = item.receives;
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
