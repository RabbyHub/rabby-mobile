import { strings } from '@/utils/i18n';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemCateType } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
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
    const isSwap = tokenList.length > 1; // need filter in swap history
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
