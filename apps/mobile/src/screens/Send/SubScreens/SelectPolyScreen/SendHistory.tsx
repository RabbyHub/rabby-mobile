/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Text, View } from 'react-native';
import { HistoryItem } from '@/screens/Transaction/components/HistoryItem';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { Empty } from '@/screens/Transaction/components/Empty';
import { useTranslation } from 'react-i18next';
import { useRecentSend } from '../../hooks/useRecentSend';
import { SendAction } from '@rabby-wallet/rabby-api/dist/types';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ellipsisAddress } from '@/utils/address';
import { useGetCexList } from '@/screens/Transaction/hook';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}

interface IProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  isForMultipleAddress?: boolean;
  onPressAddToWhitelistButton?: (data: SendAction) => void;
}
export const SendHistory = ({
  visible,
  onClose,
  title,
  isForMultipleAddress = true,
  onPressAddToWhitelistButton,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { t } = useTranslation();
  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);
  const { markedList, runAsync } = useRecentSend({
    useAllHistory: isForMultipleAddress,
  });
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const { getCexInfoByAddress } = useGetCexList();

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
    if ('project_item' in item.data) {
      return (
        <>
          {item.isDateStart ? (
            <Text style={[styles.date]}>{formatTimestamp(item.time, t)}</Text>
          ) : null}
          <HistoryItem
            data={item.data}
            isForMultipleAddress={isForMultipleAddress}
            getCexInfoByAddress={getCexInfoByAddress}
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
            isForMultipleAddress={isForMultipleAddress}
            // historySuccessList={historySuccessList}
            data={item.data}
            canCancel={canCancel}
            getCexInfoByAddress={getCexInfoByAddress}
            isInSendHistory={true}
            closeHistoryPopup={onClose}
            onPressAddToWhitelistButton={onPressAddToWhitelistButton}
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
          marginBottom: 10,
        }}
      />
      {Boolean(!isForMultipleAddress && currentAccount) && (
        <AddressItem account={currentAccount!}>
          {({ WalletIcon, WalletAddress }) => {
            return (
              <View style={styles.addressRow}>
                <WalletIcon style={styles.walletIcon} />
                <Text style={styles.address}>
                  {currentAccount?.aliasName ||
                    ellipsisAddress(currentAccount?.address || '')}
                </Text>
              </View>
            );
          }}
        </AddressItem>
      )}
      <BottomSheetFlatList
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
          isForMultipleAddress
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletIcon: {
    borderRadius: 4,
    width: 18,
    height: 18,
    marginRight: 4,
  },
  address: {
    margin: 4,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    lineHeight: 20,
    fontSize: 16,
    color: colors2024['neutral-foot'],
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
