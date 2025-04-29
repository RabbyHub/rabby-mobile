/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef } from 'react';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { formatTimestamp } from '@/utils/time';
import { Text } from 'react-native';
import { HistoryItem } from '@/screens/Transaction/components/HistoryItem';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { Empty } from '@/screens/Transaction/components/Empty';
import { useTranslation } from 'react-i18next';
import { useRecentSend } from '../../hooks/useRecentSend';
import { SendAction } from '@rabby-wallet/rabby-api/dist/types';
import { useCurrentAccount } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}

interface IProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  onPressBottomBtn?: (data: SendAction) => void;
  isForMultipleAddress?: boolean;
}
export const SendHistory = ({
  visible,
  onClose,
  title,
  onPressBottomBtn,
  isForMultipleAddress = true,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { t } = useTranslation();
  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);
  const { markedList, runAsync } = useRecentSend();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
      runAsync();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible, runAsync]);

  const dataList = useMemo(() => {
    if (!isForMultipleAddress && currentAccount?.address) {
      return markedList.filter(item =>
        isSameAddress(item.data.address, currentAccount?.address),
      );
    } else {
      return markedList;
    }
  }, [markedList, currentAccount, isForMultipleAddress]);

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
            isForMultipleAdderss={isForMultipleAddress}
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
            isForMultipleAdderss={isForMultipleAddress}
            // historySuccessList={historySuccessList}
            data={item.data}
            canCancel={canCancel}
            isInSendHistory={true}
            closeHistoryPopup={onClose}
            onPressBottomBtn={onPressBottomBtn}
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
        title={title || t('page.sendPoly.SendHistory')}
        style={{
          paddingTop: ModalLayouts.titleTopOffset,
          fontFamily: 'SF Pro Rounded',
          fontWeight: '800',
          fontSize: 20,
          lineHeight: 24,
        }}
      />
      <BottomSheetFlatList
        data={dataList}
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
