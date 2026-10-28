import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, FlatList, Image, View } from 'react-native';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Skeleton } from '@rneui/themed';
import { Text } from '@/components/Typography';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BridgeHistoryItem } from '@/components2024/HistoryItem/BridgeHistoryItem';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import {
  useSafeAreaInsets,
  useSafeAreaFrame,
} from 'react-native-safe-area-context';
import { createGetStyles2024 } from '@/utils/styles';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import Empty from '@/assets2024/images/lending/empty.png';
import EmptyDark from '@/assets2024/images/lending/empty-dark.png';
import { useBridgeHistory } from '../hooks/history';
import { sameBridgeHash } from '../utils/record';
import { openBridgeDetail } from '../utils/navigation';

type Entry =
  | { id: string; date: string; history?: undefined }
  | { id: string; history: BridgeHistory; date?: undefined };

const HISTORY_SKELETON_COUNT = 5;

function HistorySkeleton() {
  const { styles } = useTheme2024({ getStyle });
  const rows: React.ReactNode[] = [];
  for (let index = 0; index < HISTORY_SKELETON_COUNT; index += 1) {
    rows.push(<Skeleton key={index} style={styles.skeleton} />);
  }
  return <View style={styles.skeletonList}>{rows}</View>;
}

function HistoryList({
  enabled,
  onSelect,
  isForMultipleAddress,
}: {
  enabled: boolean;
  onSelect: () => void;
  isForMultipleAddress: boolean;
}) {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { txList, loading, loadingMore, loadMore, noMore } =
    useBridgeHistory(enabled);
  const [locals, setLocals] = useState<BridgeTxHistoryItem[]>([]);
  // 交易集合或状态变化时重读本地记录，补充源链确认及取消信息。
  const statusKey = txList?.list
    .map(item => `${item.from_tx.tx_id}:${item.status}:${item.from_tx.status}`)
    .join('|');
  useEffect(() => {
    let active = true;
    if (enabled && account?.address) {
      transactionHistoryServiceApi
        .getBridgeTxHistory(account.address)
        .then(records => {
          if (active) {
            setLocals(records);
          }
        })
        .catch(error =>
          console.warn('[BridgeHistory] load local history failed', error),
        );
    }
    return () => {
      active = false;
    };
  }, [enabled, account?.address, statusKey]);
  const entries = useMemo(() => {
    const result: Entry[] = [];
    let previousDate = '';
    for (const history of [...(txList?.list || [])].sort(
      (a, b) => b.create_at - a.create_at,
    )) {
      const date = dayjs(history.create_at * 1000).format('YYYY-MM-DD');
      if (date !== previousDate) {
        result.push({
          id: `date:${date}`,
          date:
            date === dayjs().format('YYYY-MM-DD')
              ? t('page.bridge.status.today')
              : dayjs(history.create_at * 1000).format('MMM D, YYYY'),
        });
        previousDate = date;
      }
      result.push({
        id: `${history.from_token.chain}:${history.from_tx.tx_id}`,
        history,
      });
    }
    return result;
  }, [txList, t]);
  const renderItem = useCallback(
    ({ item }: { item: Entry }) => {
      if (!item.history) {
        return <Text style={styles.date}>{item.date}</Text>;
      }
      const data = item.history;
      const local = locals.find(
        record =>
          record.fromToken.chain === data.from_token.chain &&
          (sameBridgeHash(record.hash, data.from_tx.tx_id) ||
            sameBridgeHash(record.acceleratedHash, data.from_tx.tx_id)),
      );
      return (
        <View style={styles.row}>
          <BridgeHistoryItem
            data={data}
            local={local}
            enabled={enabled}
            onPress={() => {
              // 先关闭历史弹窗再进入详情，避免弹层覆盖新页面。
              onSelect();
              openBridgeDetail({
                address: account?.address || '',
                history: data,
                local,
                isForMultipleAddress,
              });
            }}
          />
        </View>
      );
    },
    [
      locals,
      enabled,
      onSelect,
      account?.address,
      isForMultipleAddress,
      styles.date,
      styles.row,
    ],
  );
  return (
    <>
      <Text style={styles.title}>{t('page.bridge.status.historyTitle')}</Text>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: bottom + 20 }}
        onEndReached={() => {
          if (!noMore) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
        ListEmptyComponent={
          loading ? (
            <HistorySkeleton />
          ) : (
            <View style={styles.empty}>
              <Image
                source={isLight ? Empty : EmptyDark}
                style={styles.emptyImage}
              />
              <Text style={styles.emptyText}>
                {t('page.swap.no-transaction-records')}
              </Text>
            </View>
          )
        }
      />
    </>
  );
}

export function BridgeTxHistory({
  visible,
  onClose,
  isForMultipleAddress = false,
}: {
  visible: boolean;
  onClose: () => void;
  recentShowTime?: number;
  isForMultipleAddress?: boolean;
}) {
  const ref = useRef<BottomSheetModalMethods>(null);
  const focused = useIsFocused();
  const appState = useAppState();
  // 弹窗隐藏、页面失焦或应用退到后台时暂停列表请求和计时。
  const active = visible && focused && appState === 'active';
  const { height } = useSafeAreaFrame();
  const { colors2024, isLight } = useTheme2024();
  useEffect(() => {
    visible ? ref.current?.present() : ref.current?.dismiss();
  }, [visible]);
  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      // 仅在弹窗可见时拦截返回键，避免关闭后阻止正常返回。
      if (!visible) {
        return false;
      }
      ref.current?.dismiss();
      return true;
    }, [visible]),
    { autoEffectEnabled: false },
  );
  useFocusEffect(onHardwareBackHandler);
  return (
    <AppBottomSheetModal
      ref={ref}
      snapPoints={[Math.min(652, height * 0.9)]}
      enableContentPanningGesture={false}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      {/* 关闭时卸载列表，停止后续轮询和行内计时。 */}
      {visible && (
        <HistoryList
          enabled={active}
          isForMultipleAddress={isForMultipleAddress}
          onSelect={() => {
            // 点击记录时立即卸载弹窗，由 onDismiss 同步关闭状态。
            ref.current?.destroy();
          }}
        />
      )}
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    marginTop: 10,
    marginBottom: 18,
  },
  list: { paddingHorizontal: 16 },
  date: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    marginLeft: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  row: { marginBottom: 8 },
  skeletonList: { gap: 8 },
  skeleton: { width: '100%', height: 74, borderRadius: 16 },
  emptyImage: { width: 163, height: 126 },
  empty: { marginTop: 100, alignItems: 'center', gap: 16 },
  emptyText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    color: colors2024['neutral-info'],
  },
}));
