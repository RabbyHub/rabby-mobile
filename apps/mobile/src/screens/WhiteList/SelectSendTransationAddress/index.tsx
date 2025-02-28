import React, { useEffect, useMemo, useState } from 'react';
import { makeTxPageBackgroundColors } from '@/constant/layout';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { useMemoizedFn } from 'ahooks';
import { unionBy, orderBy, debounce } from 'lodash';
import { HistoryList } from '@/screens/Transaction/components/HistoryGroupList';
import { useMyAccounts } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { ensureHistoryListItemFromDb } from '@/screens/Transaction/components/utils';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';

function SendHistoryScreen() {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);
  const [currentNoDbData, setCurrentNoDbData] = useState(false);
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);

  const { syncTop10History } = useSyncHistoryDB(unionAccounts);
  const { tokenDict, historyEnsureNoData } = useHistoryTokenDict();
  const { styles } = useTheme2024({ getStyle });

  const batchFetchDataV2 = async () => {
    // fetch data from local database
    const addresses = unionAccounts.map(account =>
      account.address.toLowerCase(),
    );
    const fetchHistoryFromDbData = async (isFirst?: boolean) => {
      const historyList = await HistoryItemEntity.getAllHistoryItemSortedByTime(
        addresses,
        isFirst ? 50 : 10000,
        true, // first not show scam tx
        'send',
      );

      if (isFirst) {
        setCurrentNoDbData(historyList.length === 0);
      }

      const list = historyList.map(item => {
        return {
          ...ensureHistoryListItemFromDb(item),
          isLocalBuy: false,
          isLocalSwap: false,
          isSmallUsdTx: false,
          tokenDict,
          projectDict: {},
        } as HistoryDisplayItem;
      });

      setDbData(list);
      return list;
    };
    if (!dbData.length) {
      // first init 50 count
      await fetchHistoryFromDbData(true);
    }

    // later fetch all data
    const list = await fetchHistoryFromDbData(false);
    return list;
  };

  const refresh = useMemoizedFn(() => {
    syncTop10History(true);
  });

  useEffect(() => {
    batchFetchDataV2();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thorttleBatchFetchData = debounce(batchFetchDataV2, 1000);

  useAppOrmSyncEvents({
    taskFor: ['all-history'],
    onRemoteDataUpserted: ctx => {
      switch (ctx.taskFor) {
        case 'all-history':
          thorttleBatchFetchData();
          break;
        default:
          break;
      }
    },
  });

  const allTxHistory = useMemo(() => {
    // make receive front of send by cate_id order by asc
    return orderBy(dbData || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  }, [dbData]);

  const ensureCurrentNoDbData = useMemo(() => {
    const addresses = unionAccounts.map(account =>
      account.address.toLowerCase(),
    );
    const isNodata = addresses.every(address => {
      return historyEnsureNoData[address];
    });
    return isNodata;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnsureNoData]);

  const fetchFromDbLoading = useMemo(
    () => currentNoDbData && !allTxHistory.length && !ensureCurrentNoDbData,
    [currentNoDbData, allTxHistory.length, ensureCurrentNoDbData],
  );
  const handlePressItem = (item: HistoryDisplayItem) => {
    console.log(
      '🔍 CUSTOM_LOGGER:=>: HistoryDisplayItem',
      item.sends[0].to_addr,
    );
  };

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <HistoryList
        list={allTxHistory}
        loading={fetchFromDbLoading}
        ensureCurrentNoDbData={ensureCurrentNoDbData}
        refreshLoading={false}
        isForMultipleAdderss
        onRefresh={refresh}
        onPresssItem={handlePressItem}
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    backgroundColor: makeTxPageBackgroundColors({ isLight, colors2024 }),
  },
}));

export default SendHistoryScreen;
