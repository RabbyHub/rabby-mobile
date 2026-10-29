import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { ensureHistoryListItemFromDb } from '@/utils/historyDisplay';
import { prefetchBridgeHistory } from './bridgeHistoryLookup';
import {
  BRIDGE_HISTORY_TX_BATCH,
  BRIDGE_HISTORY_WARMUP_SCAN_LIMIT,
  collectBridgeQueries,
} from './utils/bridgeHistory';

// 扫描多地址历史前 200 条非 scam 记录，最多预热 20 个 Bridge 候选。
export async function warmBridgeHistoryForAddresses(addresses: string[]) {
  if (!addresses.length) {
    return;
  }
  const { items } = await HistoryItemEntity.getHistoryItemsPaginated(
    addresses.map(address => address.toLowerCase()),
    { pageSize: BRIDGE_HISTORY_WARMUP_SCAN_LIMIT, filterScamTx: true },
  );
  prefetchBridgeHistory(
    collectBridgeQueries(
      items.map(ensureHistoryListItemFromDb),
      0,
      BRIDGE_HISTORY_WARMUP_SCAN_LIMIT,
      BRIDGE_HISTORY_TX_BATCH,
    ),
  );
}
