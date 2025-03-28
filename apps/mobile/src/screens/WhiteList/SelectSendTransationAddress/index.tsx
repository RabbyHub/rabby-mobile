import React, { useEffect, useMemo, useState } from 'react';
import { makeTxPageBackgroundColors, RootNames } from '@/constant/layout';
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
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';

function SendHistoryScreen() {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);
  const [firstFetchDone, setFirstFetchDone] = useState(false);
  const [currentNoDbData, setCurrentNoDbData] = useState(false);
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);

  const { syncTop10History } = useSyncHistoryDB(unionAccounts);
  const { tokenDict, historyLoading } = useHistoryTokenDict();
  const { styles } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();

  const batchFetchDataV2 = async () => {
    // fetch data from local database
    const addresses = unionAccounts.map(account =>
      account.address.toLowerCase(),
    );
    const fetchHistoryFromDbData = async (isFirst?: boolean) => {
      const historyList =
        await HistoryItemEntity.getAllSendItemsTriggeredByImportedAddr(
          addresses,
          isFirst ? 50 : 10000,
        );

      if (isFirst) {
        setFirstFetchDone(true);
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
  const { t } = useTranslation();

  const allTxHistory = useMemo(() => {
    // make receive front of send by cate_id order by asc
    return orderBy(dbData || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  }, [dbData]);

  const ensureCurrentIsLoading = useMemo(() => {
    const addresses = unionAccounts.map(account =>
      account.address.toLowerCase(),
    );
    const isLoading = addresses.every(address => {
      return historyLoading[address];
    });
    return isLoading;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading]);
  const { findAccount } = useWhiteListAddress(true);

  const fetchFromDbLoading = useMemo(
    () =>
      Boolean(firstFetchDone && !allTxHistory.length && ensureCurrentIsLoading),
    [firstFetchDone, allTxHistory.length, ensureCurrentIsLoading],
  );

  const handlePressItem = async (item: HistoryDisplayItem) => {
    const toAddress = item.sends[0]?.to_addr;
    if (toAddress) {
      const { inWhitelist, account } = await findAccount(toAddress);
      if (inWhitelist) {
        toast.show(t('page.whitelist.alreadyAdded'));
      } else {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.WhitelistConfirm,
          params: {
            account,
          },
        });
      }
    }
  };

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <HistoryList
        list={allTxHistory}
        loading={fetchFromDbLoading}
        firstFetchDone={firstFetchDone}
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
