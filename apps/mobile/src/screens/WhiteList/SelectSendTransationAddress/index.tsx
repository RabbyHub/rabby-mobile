import React, { useEffect, useMemo, useRef, useState } from 'react';

import { makeTxPageBackgroundColors } from '@/constant/layout';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { preferenceService } from '@/core/services';
import { EVENTS, eventBus } from '@/utils/events';
import {
  useInfiniteScroll,
  useInterval,
  useMemoizedFn,
  useRequest,
} from 'ahooks';
import { unionBy, orderBy, debounce } from 'lodash';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  BuyHistoryItem,
  TxHistoryItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { HistoryList } from '@/screens/Transaction/components/HistoryGroupList';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import {
  ensureHistoryListItemFromDb,
  judgeIsSmallUsdTx,
} from '@/screens/Transaction/components/utils';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { BuyItemEntity } from '@/databases/entities/buyItem';

export interface HistoryDisplayItem extends TxHistoryItem {
  projectDict: TxHistoryResult['project_dict'];
  cateDict: TxHistoryResult['cate_dict'];
  tokenDict: TxHistoryResult['token_dict'];
  address: string;
  key: string;
  account?: KeyringAccountWithAlias;
  isLocalBuy?: boolean;
  buyDetails?: BuyItemEntity & BuyHistoryItem;
  isLocalSwap?: boolean;
  isShowSuccess?: boolean;
  isSmallUsdTx?: boolean;
}

function History(): JSX.Element {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(sortedAccounts, account => account.address.toLowerCase());
  }, [sortedAccounts]);
  const isReady = useRef(false);
  const lastMap = useRef<Record<string, number>>({});
  const hasMoreMap = useRef<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [currentNoDbData, setCurrentNoDbData] = useState(false);
  const [dbData, setDbData] = useState<HistoryDisplayItem[]>([]);
  const {
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    sceneCurrentAccountDepKey,
  } = useSceneAccountInfo({
    forScene: 'MultiHistory',
  });
  const { syncTop10History, syncSingleAddress } =
    useSyncHistoryDB(unionAccounts);
  const { projectDict, tokenDict, historyEnsureNoData } = useHistoryTokenDict();

  const batchFetchDataV2 = async () => {
    // fetch data from local database
    const addresses = isSceneUsingAllAccounts
      ? unionAccounts.map(account => account.address.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase()!];
    const fetchHistoryFromDbData = async (isFirst?: boolean) => {
      const historyList = await HistoryItemEntity.getAllHistoryItemSortedByTime(
        addresses,
        isFirst ? 50 : 10000,
        isFirst, // first not show scam tx
        'send',
      );

      if (isFirst) {
        setCurrentNoDbData(historyList.length === 0);
      }

      const pinedQueue = preferenceService.getPinToken();
      const list = historyList.map(item => {
        return {
          ...ensureHistoryListItemFromDb(item),
          isLocalBuy: false,
          isLocalSwap: false,
          isSmallUsdTx: judgeIsSmallUsdTx(item, tokenDict, pinedQueue),
          tokenDict,
          projectDict,
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

  const batchFetchData = async () => {
    const res = await batchFetchDataV2();
    if (!isReady.current) {
      isReady.current = true;
    }
    return { list: res };
  };

  const batchFetchLocalTx = async () => {
    const list: TransactionGroup[] = [];
    const accountList = isSceneUsingAllAccounts
      ? unionAccounts
      : [finalSceneCurrentAccount];
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
    }
    return list;
  };

  const { data: groups, runAsync: runFetchLocalTx } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  useInterval(() => runFetchLocalTx(), groups?.length ? 5000 : 60 * 1000);

  const refresh = useMemoizedFn(() => {
    lastMap.current = {};
    hasMoreMap.current = {};
    setCurrentPage(0);
    runFetchLocalTx();

    isSceneUsingAllAccounts
      ? syncTop10History(true)
      : syncSingleAddress(finalSceneCurrentAccount?.address.toLowerCase()!);
  });

  useEffect(() => {
    if (isReady.current) {
      batchFetchDataV2();
      runFetchLocalTx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneCurrentAccountDepKey, isSceneUsingAllAccounts]);

  const { loadingMore, loadMore } = useInfiniteScroll(() => batchFetchData(), {
    isNoMore: () => {
      return true;
    },
    onSuccess() {
      setCurrentPage(currentPage + 1);
      runFetchLocalTx();
    },
  });

  const thorttleBatchFetchData = debounce(batchFetchData, 1000);

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

  const data = useMemo(() => {
    return { list: dbData };
  }, [dbData]);

  const allTxHistory = useMemo(() => {
    // make receive front of send by cate_id order by asc
    return orderBy(data?.list || [], ['time_at', 'cate_id'], ['desc', 'asc']);
  }, [data]);

  useFocusEffect(() => {
    eventBus.addListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, runFetchLocalTx);
    };
  });

  const ensureCurrentNoDbData = useMemo(() => {
    const addresses = isSceneUsingAllAccounts
      ? unionAccounts.map(account => account.address.toLowerCase())
      : [finalSceneCurrentAccount?.address.toLowerCase()!];
    const isNodata = addresses.every(address => {
      return historyEnsureNoData[address];
    });
    return isNodata;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnsureNoData, sceneCurrentAccountDepKey]);

  const fetchFromDbLoading = useMemo(
    () =>
      currentNoDbData &&
      !allTxHistory.length &&
      !groups?.length &&
      !ensureCurrentNoDbData,
    [
      currentNoDbData,
      allTxHistory.length,
      groups?.length,
      ensureCurrentNoDbData,
    ],
  );

  return (
    <View style={{ paddingTop: 0, position: 'relative' }}>
      <HistoryList
        historySuccessList={[]}
        list={[...(groups || []), ...(allTxHistory || [])]}
        localTxList={groups}
        loading={fetchFromDbLoading}
        ensureCurrentNoDbData={ensureCurrentNoDbData}
        loadingMore={loadingMore}
        refreshLoading={false}
        isForMultipleAdderss
        loadMore={loadMore}
        onRefresh={refresh}
      />
    </View>
  );
}

const HistoryScreen = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <History />
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    backgroundColor: makeTxPageBackgroundColors({ isLight, colors2024 }),
  },
  menuContainer: {
    elevation: 5,
    shadowColor: 'rgba(25, 35, 60, 0.2)', // Shadow color
    shadowOffset: { width: 0, height: 12 }, // Horizontal and vertical offsets
    shadowOpacity: 0.2, // Shadow opacity
    shadowRadius: 8, // Blur radius
    // flexDirection: 'row',
    zIndex: 1,
    // justifyContent: 'space-between',
    position: 'absolute',
    top: 0,
    right: 16,
    alignItems: 'center',
    width: 270,
    // height: 56,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    paddingVertical: 16,
    // paddingVertical: 16,
    borderRadius: 16,
    gap: 16,
  },
  menuItem: {
    // height: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    // alignItems: 'center',
  },
  menuItemText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  valueView: {
    // width: '50%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  link: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: colors2024['brand-light-1'],
    borderWidth: 1,
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['brand-default'],
  },
  headerTitle: {
    flexWrap: 'nowrap',
    // justifyContent: 'center',
    // alignItems: 'center',
    flexDirection: 'row',
  },
  titleText: {
    marginLeft: 4,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  netTabs: {
    marginBottom: 12,
  },
  notFound: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80%',
  },
  notFoundText: {
    fontSize: 14,
    lineHeight: 17,
    color: colors2024['neutral-body'],
    marginTop: 16,
  },
}));

export default HistoryScreen;
