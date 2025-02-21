import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { RcIconSwapHistoryEmpty } from '@/assets/icons/swap';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts, RootNames } from '@/constant/layout';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuyHistory } from '../hooks/history';
import { BuyHistoryItem } from '@/components2024/HistoryItem/BuyHistoryItem';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { ensureHistoryListItemFromDb } from '@/screens/Transaction/components/utils';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { naviPush } from '@/utils/navigation';
import { BuyHistoryItem as TBuyHistoryItem } from '@rabby-wallet/rabby-api/dist/types';

const ItemSeparator = () => {
  const { styles } = useTheme2024({ getStyle });
  return <View style={styles.item} />;
};

const HistoryList = ({
  onGoToDetail,
}: {
  onGoToDetail: (txId: string, chain: string, data: any) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { txList, loading, loadMore, noMore } = useBuyHistory();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }: { item: TBuyHistoryItem }) => (
      <TouchableOpacity
        onPress={() =>
          onGoToDetail(item.receive_tx_id, item.receive_chain_id, item)
        }>
        <BuyHistoryItem data={item} />
      </TouchableOpacity>
    ),
    [onGoToDetail],
  );

  const ListHeaderComponent = useCallback(() => {
    return <Text style={styles.headerTitle}>{t('page.buy.history')}</Text>;
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
      keyExtractor={item => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={ListEndLoader}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const generateTempBuyHistoryData = ({
  addr,
  chain,
  time_at,
  txId,
}: {
  addr: string;
  chain: string;
  txId?: string;
  time_at: number;
}) => ({
  address: addr,
  cateDict: {},
  cate_id: 'receive',
  chain: chain,
  debt_liquidated: null,
  id: txId,
  is_scam: false,
  owner_addr: addr,
  project_id: '',
  receives: [],
  sends: [],
  status: 0,
  time_at,
  token_approve: { spender: '', token_id: '', value: 0 },
  token_approve_id: '',
  token_approve_spender: '',
  token_approve_value: 0,

  tx_to_address: addr,
});

export const BuyHistory = ({
  visible,
  onClose,
  isForMultipleAdderss,
}: {
  visible: boolean;
  onClose: () => void;
  isForMultipleAdderss?: boolean;
}) => {
  const { t } = useTranslation();
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { colors2024 } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  const { projectDict, tokenDict } = useHistoryTokenDict();

  const goToDetail = useCallback(
    async (txId: string, chain: string, data: TBuyHistoryItem) => {
      const historyItem =
        txId && chain
          ? await HistoryItemEntity.findOne({
              where: { txHash: txId, chain },
            })
          : null;
      const detailData = {
        ...(historyItem
          ? ensureHistoryListItemFromDb(historyItem)
          : (generateTempBuyHistoryData({
              txId: data.receive_tx_id,
              time_at: data.create_at,
              addr: data.user_addr,
              chain: chain,
            }) as ReturnType<typeof ensureHistoryListItemFromDb>)),
        isLocalBuy: true,
        buyDetails: data as unknown as any,
        projectDict,
        tokenDict,
      };

      onClose();
      naviPush(RootNames.StackTransaction, {
        screen: RootNames.HistoryDetail,
        params: {
          isForMultipleAdderss,
          data: detailData,
          title: t('page.transactions.itemTitle.Buy'),
        },
      });
    },
    [projectDict, tokenDict, onClose, isForMultipleAdderss, t],
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
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg2',
      })}>
      <HistoryList onGoToDetail={goToDetail} />
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
