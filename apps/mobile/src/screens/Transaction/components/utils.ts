import type { HistoryDisplayItem } from '@/types/history';
import { getTokenSymbol } from '@/utils/token';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import type { IManageToken } from '@/types/assets';
import {
  fetchHistoryTokenItem,
  fetchHistoryTokenUUId,
  getHistoryItemType,
  isNFTTokenId,
} from '@/utils/history';
import { ensureHistoryListItemFromDb } from '@/utils/historyDisplay';

export {
  fetchHistoryTokenItem,
  fetchHistoryTokenUUId,
  getHistoryItemType,
  isNFTTokenId,
  ensureHistoryListItemFromDb,
};
export {
  loadTxSaveFromLocalStore,
  txDonePatchTokenAmountInDb,
} from '@/databases/sync/history';

export function getApproveTokeName(data: HistoryDisplayItem): string {
  const tokenId = data.token_approve?.token_id || '';
  const tokenIsNft = tokenId?.length === 32;
  if (tokenIsNft) {
    return 'NFT';
  }

  return getTokenSymbol(data.token_approve?.token);
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
