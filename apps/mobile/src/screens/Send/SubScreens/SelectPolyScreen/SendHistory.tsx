/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { HistoryList } from '@/screens/Transaction/components/HistoryGroupList';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import { useMemoizedFn, useRequest } from 'ahooks';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useMyAccounts } from '@/hooks/account';
import { minBy, unionBy } from 'lodash';
import { transactionHistoryService } from '@/core/services';
import { findChain } from '@/utils/chain';
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { formatTimestamp } from '@/utils/time';
import { Text } from 'react-native';
import { HistoryItem } from '@/screens/Transaction/components/HistoryItem';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { Empty } from '@/screens/Transaction/components/Empty';
import { useTranslation } from 'react-i18next';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}

function markFirstItems(
  arr: (HistoryDisplayItem | TransactionGroup)[],
): DisplayHistoryItem[] {
  if (arr.length === 0) {
    return [];
  }
  const newArr: DisplayHistoryItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const newItem: DisplayHistoryItem = {
      data: item,
      time:
        ('time_at' in item ? item.time_at * 1000 : undefined) ||
        ('completedAt' in item && item.completedAt
          ? item.completedAt
          : new Date().getTime()),
    };

    const prev = arr[i - 1];

    if (i === 0) {
      newItem.isDateStart = true;
    } else {
      // judgs is date start
      const curDate = dayjs(newItem.time);
      const prevTime =
        ('time_at' in prev ? prev.time_at * 1000 : undefined) ||
        ('completedAt' in prev && prev.completedAt
          ? prev.completedAt
          : new Date().getTime());
      const prevDate = dayjs(prevTime); // get time at
      if (!curDate.isSame(prevDate, 'date')) {
        newItem.isDateStart = true;
      }
    }

    newArr.push(newItem);
  }

  return newArr;
}

interface IProps {
  visible: boolean;
  onClose: () => void;
}
export const SendHistory = ({ visible, onClose }: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { t } = useTranslation();
  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);

  const { data: historyList, runAsync } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  const batchFetchLocalTx = async () => {
    const list: TransactionGroup[] = [];
    const accountList = unionAccounts;
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
      const addr = account.address.toLowerCase();
      const localTxs = fetchLocalTx(addr);
      list.push(...localTxs);
    }
    return list;
  };

  const fetchLocalTx = useMemoizedFn((address: string) => {
    const { completeds: _completeds } =
      transactionHistoryService.getList(address);

    const completeds = _completeds.filter(item => {
      const chain = findChain({ id: item.chainId });
      return (
        !chain?.isTestnet &&
        !item.isSubmitFailed &&
        item.$ctx?.ga?.source === 'sendToken'
      );
    });

    return completeds;
  });

  const markedList = useMemo(() => {
    return markFirstItems(
      unionBy(historyList, item => {
        if ('projectDict' in item) {
          return `${item.address.toLowerCase()}-${item.id}`;
        } else {
          return `${item.address.toLowerCase()}-${item.maxGasTx.hash}`;
        }
      }) || [],
    );
  }, [historyList]);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
      runAsync();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible, runAsync]);

  const isDarkTheme = useGetBinaryMode() === 'dark';

  const renderItem = ({ item }: { item: DisplayHistoryItem }) => {
    if ('projectDict' in item.data) {
      return (
        <>
          {item.isDateStart ? (
            <Text style={[styles.date]}>{formatTimestamp(item.time, t)}</Text>
          ) : null}
          <HistoryItem
            data={item.data}
            isForMultipleAdderss={true}
            projectDict={item.data.projectDict}
            cateDict={item.data.cateDict}
            tokenDict={item.data.tokenDict || {}}
            // onPress={onPresssItem}
          />
        </>
      );
    } else {
      const canCancel = false;

      return (
        <>
          {item.isDateStart ? (
            <Text style={[styles.date]}>{formatTimestamp(item.time, t)}</Text>
          ) : null}
          <TransactionItem
            isForMultipleAdderss={true}
            // historySuccessList={historySuccessList}
            data={item.data}
            canCancel={canCancel}
            isInSendHistory={true}
            closeHistoryPopup={onClose}
            // onRefresh={onRefresh}
          />
        </>
      );
    }
  };

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      // enablePanDownToClose={true}
      // enableDismissOnClose={true}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isDarkTheme ? 'bg1' : 'bg2',
      })}>
      {/* <BottomSheetScrollView> */}
      <AppBottomSheetModalTitle
        title={t('page.sendPoly.SendHistory')}
        style={{
          paddingTop: ModalLayouts.titleTopOffset,
          fontWeight: '800',
          fontSize: 20,
          lineHeight: 24,
        }}
      />
      <BottomSheetFlatList
        removeClippedSubviews
        data={markedList}
        renderItem={renderItem}
        windowSize={5}
        ListEmptyComponent={<Empty />}
        style={styles.container}
        // onEndReached={loadMore}
        onEndReachedThreshold={0.8}
      />
      {/* <HistoryList
          list={historyList}
          loading={false}
          firstFetchDone={true}
          refreshLoading={false}
          isForMultipleAdderss
          // onPresssItem={handlePressItem}
        /> */}
      {/* </BottomSheetScrollView> */}
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 15,
  },
  icon: {
    width: 24,
    height: 24,
  },
  date: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 8,
    marginTop: 12,
    marginBottom: 8,
    color: colors2024['neutral-secondary'],
    lineHeight: 18,
  },
}));
