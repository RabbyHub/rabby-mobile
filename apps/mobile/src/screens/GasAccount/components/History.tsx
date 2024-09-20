import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Animated,
  Easing,
  ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { findChainByServerID } from '@/utils/chain';
import RcIconHistoryLoading from '@/assets/icons/gas-account/IconHistoryLoading.svg';
import { openExternalUrl } from '@/core/utils/linking';
import { sinceTime } from '@/utils/time';
import { useGasAccountHistory } from '../hooks';
import RcIconHistoryIcon from '@/assets/icons/gas-account/history-icon.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HistoryItem = ({
  time,
  isPending = false,
  value = 0,
  sign = '-',
  borderT = false,
  chainServerId,
  txId,
}: {
  time: number;
  value: number;
  sign: string;
  className?: string;
  isPending?: boolean;
  borderT?: boolean;
  chainServerId?: string;
  txId?: string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const transAnim = React.useRef(new Animated.Value(0));

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(transAnim.current, {
        toValue: 360,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const rotate = transAnim.current.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.historyItem, borderT && styles.borderTop]}>
      {isPending ? (
        <View style={styles.pendingContainer}>
          <Animated.View
            style={{
              ...styles.pendingIcon,
              transform: [
                {
                  rotate,
                },
              ],
            }}>
            <RcIconHistoryLoading />
          </Animated.View>

          <Text style={styles.pendingText}>{t('page.gasAccount.deposit')}</Text>
        </View>
      ) : (
        <Text style={styles.timeText}>{sinceTime(time)}</Text>
      )}
      <Text style={styles.valueText}>
        {sign}
        {formatUsdValue(value)}
      </Text>
    </View>
  );
};

const LoadingItem = ({ borderT }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.loadingItem, borderT && styles.borderTop]}>
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
    </View>
  );
};

export const GasAccountHistory = () => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { loading, txList, loadingMore, loadMore, noMore } =
    useGasAccountHistory();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { bottom } = useSafeAreaInsets();

  const ListEmptyComponent = useMemo(
    () =>
      !loading && (!txList || !txList?.list?.length) ? (
        <View style={styles.historyContainer}>
          <RcIconHistoryIcon style={styles.historyIcon} />
          <Text style={styles.historyText}>
            {t('component.gasAccount.history.noHistory')}
          </Text>
        </View>
      ) : loading ? (
        <>
          {Array.from({ length: 10 }).map((_, idx) => (
            <LoadingItem key={idx} borderT={idx !== 0} />
          ))}
        </>
      ) : null,
    [
      loading,
      txList,
      styles.historyContainer,
      styles.historyIcon,
      styles.historyText,
      t,
    ],
  );

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <LoadingItem borderT />;
  }, [noMore]);

  const ListHeaderComponent = useCallback(() => {
    return (
      !loading &&
      txList?.rechargeList?.map((item, index) => (
        <HistoryItem
          key={item.tx_id + item.chain_id}
          time={item.create_at}
          value={item.amount}
          sign={'+'}
          borderT={index !== 0}
          isPending={true}
          chainServerId={item?.chain_id}
          txId={item?.tx_id}
        />
      ))
    );
  }, [loading, txList?.rechargeList]);

  const renderItem: ListRenderItem<{
    id: string;
    chain_id: string;
    create_at: number;
    gas_cost_usd_value: number;
    gas_account_id: string;
    tx_id: string;
    usd_value: number;
    user_addr: string;
    history_type: 'tx' | 'recharge' | 'withdraw';
  }> = useCallback(
    ({ item, index }) => (
      <HistoryItem
        key={item.tx_id + item.chain_id}
        time={item.create_at}
        value={item.usd_value}
        sign={item.history_type === 'recharge' ? '+' : '-'}
        borderT={!txList?.rechargeList.length ? index !== 0 : true}
      />
    ),
    [txList?.rechargeList],
  );

  if (!loading && !txList?.rechargeList.length && !txList?.list.length) {
    return (
      <View style={styles.historyContainer}>
        <RcIconHistoryIcon style={styles.historyIcon} />
        <Text style={styles.historyText}>
          {t('component.gasAccount.history.noHistory')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { marginBottom: bottom }]}
      data={txList?.list}
      contentInset={{ bottom: 12 }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={renderItem}
      extraData={txList?.rechargeList.length}
      keyExtractor={item => `${item.tx_id}${item.chain_id}`}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={ListEndLoader}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    backgroundColor: colors['neutral-card-1'],
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    // padding: 16,
    paddingTop: 0,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['orange-light'],
    borderRadius: 50,
    padding: 10,
  },
  pendingIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['orange-default'],
  },
  externalIcon: {
    width: 12,
    height: 12,
  },
  timeText: {
    fontSize: 14,
    color: colors['neutral-foot'],
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  loadingItem: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  skeletonStyle: {
    height: 16,
    borderRadius: 4,
    width: 68,
  },
  borderTop: {
    borderTopWidth: 0.5,
    borderTopColor: colors['neutral-card2'],
  },
  historyContainer: {
    display: 'flex',
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 531,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  historyIcon: {
    marginTop: 120,
    width: 28,
    height: 28,
    marginBottom: 8,
  },
  historyText: {
    color: colors['neutral-foot'],
    fontWeight: '500',
    fontSize: 13,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 150,
  },
  emptyList: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
  },
  emptyText: {
    textAlign: 'center',
    color: colors['neutral-foot'],
    fontSize: 14,
  },
  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
    marginBottom: 12,
  },
}));
