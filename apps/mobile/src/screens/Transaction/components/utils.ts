import { HistoryDisplayItem } from '../MultiAddressHistory';
import { getTokenSymbol } from '@/utils/token';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import {
  NFTItem,
  TokenItem,
  TokenItemWithEntity,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { IManageToken } from '@/core/services/preference';
import {
  SwapTxHistoryItem,
  TransactionHistoryItem,
} from '@/core/services/transactionHistory';
import { LocalHistoryItemEntity } from '@/databases/entities/localhistoryItem';
import { duplicatelyStringifiedAppJsonStore } from '@/core/storage/mmkv';
import { openapi } from '@/core/request';
import { patchSingleToken } from '@/databases/sync/assets';
import { HistoryItemCateType } from './type';
import {
  GAS_ACCOUNT_RECEIVED_ADDRESS,
  GAS_ACCOUNT_WITHDRAWED_ADDRESS,
  L2_DEPOSIT_ADDRESS_MAP,
} from '@/constant/gas-account';

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

export const fetchHistoryTokenUUId = (
  token_id: string,
  chain: string,
): string => {
  return `${chain}_token:${token_id}`;
};

export const fetchHistoryTokenItem = (
  token_id: string,
  chain: string,
  tokenDict: Record<string, TokenItem>,
) => {
  const tokenUUID = `${chain}_token:${token_id}`;
  // TODO: {} is a temporary fix, need to make one real TokenItem object
  return tokenDict[tokenUUID] || tokenDict[token_id] || ({} as TokenItem);
};

export const ensureHistoryListItemFromDb = (item: HistoryItemEntity) => {
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

      name: '', // no use
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
    project_item: item.project_item,
    key: item._db_id,
    address: item.owner_addr,
    isSmallUsdTx: item.is_small_tx,
    cateDict: {}, // no use
    debt_liquidated: null,
  };
};

export const judgeIsSmallUsdTx = (
  item: HistoryItemEntity,
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
  const currentTime = new Date().getTime();
  if (item.time_at * 1000 > currentTime - 1000 * 60 * 60) {
    // 1 hour not filter
    return false;
  }

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

export const loadTxSaveFromLocalStore = async (tx: TransactionHistoryItem) => {
  try {
    const actionData = tx.action?.actionData;
    if (!actionData?.send) {
      return;
    }

    const item = new LocalHistoryItemEntity();
    LocalHistoryItemEntity.fillEntityFromLocalSend(item, tx);
    const repo = LocalHistoryItemEntity.getRepository();
    await repo.manager.save(item);
  } catch (e) {
    console.log('loadTxSaveFromLocalStore error', e);
  }
};

export const isNFTTokenId = (tokenId: string) => {
  return tokenId.length === 32;
};

export const txDonePatchTokenAmountInDb = async (
  tx: TransactionHistoryItem,
) => {
  try {
    const sendTokenList = tx.explain?.balance_change?.send_token_list;
    const receiveTokenList = tx.explain?.balance_change?.receive_token_list;
    const tokenList = [...(sendTokenList || []), ...(receiveTokenList || [])];

    Promise.allSettled(
      tokenList.map(async token => {
        try {
          const tokenRes = (await openapi.getToken(
            tx.address,
            token.chain,
            token.id,
          )) as TokenItemWithEntity;
          const cex_ids = tokenRes.identity?.cex_list?.map(item => item.id);
          tokenRes.cex_ids = cex_ids || [];
          if (tokenRes) {
            // todo: check tokenRes.cex_ids is right
            patchSingleToken(tx.address, tokenRes);
          }
        } catch (error) {
          console.error(
            `Failed to patch token ${token.id} for ${tx.address}:`,
            error,
          );
        }
      }),
    );
  } catch (e) {
    console.log('txDonePatchTokenAmountInDb error', e);
  }
};
