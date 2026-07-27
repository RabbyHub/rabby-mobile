import { getTop10MyAccounts } from '@/core/apis/account';
import { BuyItemEntity } from '@/databases/entities/buyItem';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { prepareAppDataSource } from '@/databases/imports';
import { syncTop10History } from '@/databases/hooks/history';
import { resetUpdateHistoryTime } from '@/hooks/historyTokenDict';
import {
  clearDbSyncWritePolicyOverride,
  getDbSyncWritePolicyDebugSnapshot,
  setDbSyncWritePolicyOverride,
  type DbSyncWritePolicyOverride,
} from '@/databases/sync/_task';

export async function debugResetAndSyncAllHistory(options?: {
  resetWritePolicyOverride?: boolean;
  writePolicyOverride?: DbSyncWritePolicyOverride;
}) {
  if (options?.resetWritePolicyOverride) {
    clearDbSyncWritePolicyOverride('all-history');
  }
  if (options?.writePolicyOverride) {
    setDbSyncWritePolicyOverride('all-history', options.writePolicyOverride);
  }

  const { top10Addresses } = await getTop10MyAccounts();
  const addresses = top10Addresses
    .map(address => address.toLowerCase())
    .filter(Boolean);

  console.info('[historySyncDebug] reset and sync all history start', {
    addressCount: addresses.length,
    writePolicy: getDbSyncWritePolicyDebugSnapshot('all-history'),
  });

  resetUpdateHistoryTime();
  await prepareAppDataSource();
  await Promise.all([HistoryItemEntity.clear(), BuyItemEntity.clear()]);

  if (!addresses.length) {
    console.info('[historySyncDebug] no address to sync');
    return;
  }

  await syncTop10History(addresses, true, false, {
    forceAllHistoryApi: true,
  });

  console.info('[historySyncDebug] reset and sync all history triggered', {
    addressCount: addresses.length,
  });
}
