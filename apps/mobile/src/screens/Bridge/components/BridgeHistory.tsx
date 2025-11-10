/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, Image } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useBridgeHistory } from '../hooks';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BridgeHistoryItem } from '@/components2024/HistoryItem/BridgeHistoryItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconEmpty from '@/assets2024/images/lending/empty.png';
import IconEmptyDark from '@/assets2024/images/lending/empty-dark.png';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ellipsisAddress } from '@/utils/address';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const ItemSeparator = () => {
  const { styles } = useTheme2024({ getStyle });
  return <View style={styles.item} />;
};

const HistoryList = ({ recentShowTime }: { recentShowTime: number }) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { txList, loading, loadMore, noMore } = useBridgeHistory();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }) => (
      <BridgeHistoryItem data={item} recentShowTime={recentShowTime} />
    ),
    [recentShowTime],
  );

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const ListHeaderComponent = useCallback(() => {
    return (
      <View
        style={{
          marginBottom: 12,
        }}>
        <Text style={styles.headerTitle}>{t('page.bridge.history')}</Text>
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
      if (a.status === 'pending' && b.status !== 'pending') {
        return -1;
      }
      if (a.status !== 'pending' && b.status === 'pending') {
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
        ItemSeparatorComponent={ItemSeparator}
        data={sortedList}
        renderItem={renderItem}
        keyExtractor={item => item.detail_url}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListEndLoader}
        ListEmptyComponent={ListEmptyComponent}
      />
    </>
  );
};

export const BridgeTxHistory = ({
  visible,
  onClose,
  recentShowTime,
}: {
  visible: boolean;
  onClose: () => void;
  recentShowTime: number;
}) => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { colors2024 } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  const isDarkTheme = useGetBinaryMode() === 'dark';

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isDarkTheme ? 'bg1' : 'bg2',
      })}>
      <HistoryList recentShowTime={recentShowTime} />
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  skeletonBlock: {
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  emptyView: {
    marginTop: '50%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
  flatList: {
    paddingHorizontal: 20,
  },
  item: {
    height: 8,
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
  loading: {
    marginTop: 8,
  },
}));
