/* eslint-disable react-native/no-inline-styles */
import { AppBottomSheetModal } from '@/components';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { ModalLayouts, RootNames } from '@/constant/layout';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwapHistory, useSwapTxHistoryVisible } from '../hooks/history';
import { SwapHistoryItem } from '@/components2024/HistoryItem/SwapHistoryItem';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { navigateDeprecated } from '@/utils/navigation';
import { ensureHistoryListItemFromDb } from '@/screens/Transaction/components/utils';
import { syncSingleAddress } from '@/databases/hooks/history';
import IconEmpty from '@/assets2024/images/lending/empty.png';
import IconEmptyDark from '@/assets2024/images/lending/empty-dark.png';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ellipsisAddress } from '@/utils/address';
import { transactionHistoryService } from '@/core/services';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  flatList: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingBottom: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
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
  skeletonBlock: {
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  loading: {
    marginTop: 8,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 150,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  item: {
    height: 8,
  },
}));

const ItemSeparator = () => {
  const { styles } = useTheme2024({ getStyle });
  return <View style={styles.item} />;
};

const HistoryList = ({
  onGotoDetail,
  recentShowTime,
}: {
  onGotoDetail: (txId: string) => void;
  recentShowTime: number;
}) => {
  const { txList, loading, loadMore, noMore } = useSwapHistory();
  const { t } = useTranslation();
  const { styles, isLight } = useTheme2024({ getStyle });
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity onPress={() => onGotoDetail(item.tx_id)}>
        <SwapHistoryItem data={item} recentShowTime={recentShowTime} />
      </TouchableOpacity>
    ),
    [onGotoDetail, recentShowTime],
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <View
        style={{
          marginBottom: 12,
        }}>
        <Text style={styles.headerTitle}>{t('page.swap.historyTitle')}</Text>
        {Boolean(currentAccount) && (
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
      </View>
    );
  }, [styles, t, currentAccount]);

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <ActivityIndicator style={styles.loading} />;
  }, [noMore, styles.loading]);
  const { bottom } = useSafeAreaInsets();

  const ListEmptyComponent = useMemo(
    () =>
      !loading && (!txList || !txList?.list?.length) ? (
        <View style={styles.emptyView}>
          <Image
            source={isLight ? IconEmpty : IconEmptyDark}
            width={160}
            height={120}
            style={{
              width: 163,
              height: 126,
            }}
          />
          <Text style={styles.emptyText}>
            {t('page.swap.no-transaction-records')}
          </Text>
        </View>
      ) : loading ? (
        <>
          {Array.from({ length: 10 }).map((_, idx) => (
            <Skeleton style={styles.skeletonBlock} key={idx} />
          ))}
        </>
      ) : null,
    [
      loading,
      txList,
      styles.emptyView,
      styles.emptyText,
      styles.skeletonBlock,
      isLight,
      t,
    ],
  );

  const sortedList = useMemo(() => {
    if (!txList) {
      return [];
    }
    return txList.list.sort((a, b) => {
      // status pending first
      if (a.status === 'Pending' && b.status !== 'Pending') {
        return -1;
      }
      if (a.status !== 'Pending' && b.status === 'Pending') {
        return 1;
      }
      return 0;
    });
  }, [txList]);

  return (
    <>
      {ListHeaderComponent()}
      <BottomSheetFlatList
        contentContainerStyle={[
          {
            paddingBottom: 20 + bottom,
          },
        ]}
        style={styles.flatList}
        // stickyHeaderIndices={[0]}
        // ListHeaderComponent={ListHeaderComponent}
        data={sortedList}
        ItemSeparatorComponent={ItemSeparator}
        renderItem={renderItem}
        keyExtractor={item => item.tx_id + item.chain}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListEndLoader}
        ListEmptyComponent={ListEmptyComponent}
      />
    </>
  );
};

export const SwapTxHistory = ({
  isForMultipleAddress,
  recentShowTime,
}: {
  isForMultipleAddress: boolean;
  recentShowTime: number;
}) => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);
  const { visible, setVisible } = useSwapTxHistoryVisible();
  const { colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const onDismiss = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const goToDetail = useCallback(
    async (txId: string) => {
      const historyItem = await HistoryItemEntity.findOne({
        where: { txHash: txId },
      });

      if (historyItem) {
        const detailData = {
          ...ensureHistoryListItemFromDb(historyItem),
        } as HistoryDisplayItem;

        onDismiss();
        navigateDeprecated(RootNames.StackTransaction, {
          screen: RootNames.HistoryDetail,
          params: {
            isForMultipleAddress,
            data: detailData,
            title: t('page.swap.swapped'),
          },
        });
      } else {
        const { pendings, completeds } = transactionHistoryService.getList(
          currentAccount?.address ?? '',
        );
        const arr = pendings.concat(completeds);
        const itemData = arr.find(i => i.txs[0].hash === txId);

        if (itemData) {
          onDismiss();
          navigateDeprecated(RootNames.StackTransaction, {
            screen: RootNames.HistoryLocalDetail,
            params: {
              isForMultipleAddress,
              data: itemData,
              type: HistoryItemCateType.Swap,
              title: t('page.swap.swapped'),
            },
          });
        }
      }
    },
    [onDismiss, t, isForMultipleAddress, currentAccount?.address],
  );

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  const isDarkTheme = useGetBinaryMode() === 'dark';

  useEffect(() => {
    if (currentAccount?.address) {
      syncSingleAddress(currentAccount?.address);
    }
  }, [currentAccount?.address]);

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onDismiss}
      enableDismissOnClose
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isDarkTheme ? 'bg1' : 'bg2',
      })}>
      <HistoryList onGotoDetail={goToDetail} recentShowTime={recentShowTime} />
    </AppBottomSheetModal>
  );
};
