import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemCateType } from './HistoryItemIcon';
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
