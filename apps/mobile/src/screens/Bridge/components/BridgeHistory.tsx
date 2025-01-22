import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useBridgeHistory } from '../hooks';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { RcIconSwapHistoryEmpty } from '@/assets/icons/swap';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { BridgeHistoryItem } from '@/components2024/HistoryItem/BridgeHistoryItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ItemSeparator = () => {
  const { styles } = useTheme2024({ getStyle });
  return <View style={styles.item} />;
};

const HistoryList = () => {
  const { styles } = useTheme2024({ getStyle });
  const { txList, loading, loadMore, noMore } = useBridgeHistory();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }) => <BridgeHistoryItem data={item} />,
    [],
  );

  const ListHeaderComponent = useCallback(() => {
    return <Text style={styles.headerTitle}>{t('page.bridge.history')}</Text>;
  }, [styles.headerTitle, t]);

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <Skeleton style={styles.skeletonBlock} />;
  }, [noMore, styles.skeletonBlock]);

  const ListEmptyComponent = useMemo(
    () =>
      !loading && (!txList || !txList?.list?.length) ? (
        <View style={styles.emptyView}>
          <RcIconSwapHistoryEmpty width={52} height={52} />
          <Text style={styles.emptyText}>
            {t('page.swap.no-transaction-records')}
          </Text>
        </View>
      ) : loading ? (
        <>
          {Array.from({ length: 4 }).map((_, idx) => (
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
    <BottomSheetFlatList
      contentContainerStyle={[
        {
          paddingBottom: 20 + bottom,
        },
      ]}
      style={styles.flatList}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={ItemSeparator}
      data={sortedList}
      renderItem={renderItem}
      keyExtractor={item => item.detail_url}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={ListEndLoader}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

export const BridgeTxHistory = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
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

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg2',
      })}>
      <HistoryList />
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors2024['neutral-foot'],
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
    paddingBottom: 24,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  flatList: {
    paddingHorizontal: 20,
  },
  item: {
    height: 8,
  },
}));
