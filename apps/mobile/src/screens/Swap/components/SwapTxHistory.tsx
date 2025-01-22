import { AppBottomSheetModal } from '@/components';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { RcIconSwapHistoryEmpty } from '@/assets/icons/swap';
import { ModalLayouts, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwapHistory, useSwapTxHistoryVisible } from '../hooks/history';
import { SwapHistoryItem } from '@/components2024/HistoryItem/SwapHistoryItem';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { navigate } from '@/utils/navigation';
import { ensureHistoryListItemFromDb } from '@/screens/Transaction/components/utils';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  flatList: {
    paddingHorizontal: 20,
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
  skeletonBlock: {
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
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
    color: colors2024['neutral-foot'],
    fontSize: 14,
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
}: {
  onGotoDetail: (txId: string) => void;
}) => {
  const { txList, loading, loadMore, noMore } = useSwapHistory();
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity onPress={() => onGotoDetail(item.tx_id)}>
        <SwapHistoryItem data={item} />
      </TouchableOpacity>
    ),
    [onGotoDetail],
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <View>
        <Text style={styles.headerTitle}>{t('page.swap.historyTitle')}</Text>
      </View>
    );
  }, [styles.headerTitle, t]);

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <Skeleton style={styles.skeletonBlock} />;
  }, [noMore, styles.skeletonBlock]);
  const { bottom } = useSafeAreaInsets();

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
    <BottomSheetFlatList
      contentContainerStyle={[
        {
          paddingBottom: 20 + bottom,
        },
      ]}
      style={styles.flatList}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={ListHeaderComponent}
      data={sortedList}
      ItemSeparatorComponent={ItemSeparator}
      renderItem={renderItem}
      keyExtractor={item => item.tx_id + item.chain}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={ListEndLoader}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

export const SwapTxHistory = () => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);
  const { visible, setVisible } = useSwapTxHistoryVisible();
  const { colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { projectDict, tokenDict } = useHistoryTokenDict();

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
          tokenDict,
          projectDict,
        };

        onDismiss();
        navigate(RootNames.StackTransaction, {
          screen: RootNames.HistoryDetail,
          params: {
            data: detailData,
            title: t('page.swap.swapped'),
          },
        });
      }
    },
    [onDismiss, projectDict, t, tokenDict],
  );

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
      onDismiss={onDismiss}
      enableDismissOnClose
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg2',
      })}>
      <HistoryList onGotoDetail={goToDetail} />
    </AppBottomSheetModal>
  );
};
