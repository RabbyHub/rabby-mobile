import type {
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import type { TransactionHistoryItem } from '@/core/services/transactionHistory';
import {
  GAS_ACCOUNT_RECEIVED_ADDRESS,
  GAS_ACCOUNT_WITHDRAWED_ADDRESS,
  L2_DEPOSIT_ADDRESS_MAP,
} from '@/constant/gas-account';
import { HistoryItemCateType } from '@/types/history';
import { findChain } from './chain';

export const isNFTTokenId = (tokenId: string) => {
  return tokenId.length === 32;
};

export const checkIsGasDepositTx = ({
  chainId,
  hash,
  transactions,
}: {
  chainId?: number;
  hash: string;
  transactions: readonly TransactionHistoryItem[];
}) => {
  if (!hash || !chainId) {
    return false;
  }

  return transactions.some(item => {
    return item.chainId === chainId && item.hash === hash && item.isGasDeposit;
  });
};

export function getHistoryItemType(
  data: TxHistoryItem,
  transactions: readonly TransactionHistoryItem[],
): HistoryItemCateType {
  if (
    checkIsGasDepositTx({
      chainId: findChain({ serverId: data.chain })?.id,
      hash: data.id,
      transactions,
    })
  ) {
    return HistoryItemCateType.GAS_DEPOSIT;
  }
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
  return tokenDict[tokenUUID] || tokenDict[token_id] || ({} as TokenItem);
};
