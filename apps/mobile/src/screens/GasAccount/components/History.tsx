import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  Easing,
  ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconHistoryLoading from '@/assets/icons/gas-account/IconHistoryLoading.svg';
import { sinceTime } from '@/utils/time';
import { useGasAccountHistory } from '../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyHolder } from '@/components/EmptyHolder';

const HistoryItem = ({
  time,
  isPending = false,
  value = 0,
  sign = '-',
  borderT = false,
  chainServerId,
  txId,
  isWithdraw = false,
}: {
  time: number;
  value: number;
  sign: string;
  className?: string;
  isPending?: boolean;
  borderT?: boolean;
  isWithdraw?: boolean;
  chainServerId?: string;
  txId?: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
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
    <View
      style={[
        styles.historyItem,
        borderT && styles.borderTop,
        isPending && { height: 64 },
      ]}>
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
            <RcIconHistoryLoading width={16} height={16} />
          </Animated.View>

          <Text style={styles.pendingText}>
            {isWithdraw
              ? t('page.gasAccount.withdraw')
              : t('page.gasAccount.deposit')}
          </Text>
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
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={[styles.historyItem, borderT && styles.borderTop]}>
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
    </View>
  );
};

export const GasAccountHistory = () => {
  const { t } = useTranslation();
  const { loading, txList, loadingMore, loadMore, noMore } =
    useGasAccountHistory();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { bottom } = useSafeAreaInsets();

  const ListEmptyComponent = useMemo(
    () =>
      loading ? (
        <>
          {Array.from({ length: 10 }).map((_, idx) => (
            <LoadingItem key={idx} borderT={idx !== 0} />
          ))}
        </>
      ) : null,
    [loading],
  );

  const ListEndLoader = useCallback(() => {
    if (noMore) {
      return null;
    }
    return <LoadingItem borderT />;
  }, [noMore]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <>
        {!loading &&
          txList?.withdrawList?.map((item, index) => (
            <HistoryItem
              isWithdraw={true}
              key={item.create_at}
              time={item.create_at}
              value={item.amount}
              sign={'-'}
              borderT={!txList.rechargeList.length ? index !== 0 : true}
              isPending={true}
              chainServerId={item?.chain_id}
              txId={item?.tx_id}
            />
          ))}
        {!loading &&
          txList?.rechargeList?.map((item, index) => (
            <HistoryItem
              key={item.tx_id + item.chain_id}
              time={item.create_at}
              value={item.amount}
              sign={'+'}
              borderT={
                !txList?.rechargeList.length && !txList?.withdrawList.length
                  ? index !== 0
                  : true
              }
              isPending={true}
              chainServerId={item?.chain_id}
              txId={item?.tx_id}
            />
          ))}
      </>
    );
  }, [loading, txList?.rechargeList, txList?.withdrawList]);

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

  if (
    !loading &&
    !txList?.rechargeList.length &&
    !txList?.withdrawList.length &&
    !txList?.list.length
  ) {
    return (
      <View style={[styles.container, { height: 254 }]}>
        <EmptyHolder
          text={t('page.gasAccount.history.noHistory')}
          type="default"
          imgStyle={styles.emptyImg}
          textStyle={styles.emptyText}
        />
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
      keyExtractor={item => `${item.tx_id}-${item.create_at}-${item.chain_id}`}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={ListEndLoader}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    marginVertical: 10,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 100,
    padding: 10,
    borderWidth: 1,
    borderColor: colors2024['orange-light-2'],
  },
  pendingIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  pendingText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 19.73,
    letterSpacing: 0.447,
    color: colors2024['orange-default'],
  },
  externalIcon: {
    width: 12,
    height: 12,
  },
  timeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  valueText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
  },
  // loadingItem: {
  //   paddingHorizontal: 20,
  //   height: 50,

  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   paddingVertical: 12,
  // },
  skeletonStyle: {
    height: 16,
    borderRadius: 4,
    width: 68,
  },
  borderTop: {
    // borderTopWidth: 0.5,
    // borderTopColor: colors['neutral-card2'],
  },

  emptyImg: {
    width: 159,
    height: 116.928,
  },

  emptyText: {
    color: colors2024['neutral-info'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 20,
  },

  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
    marginBottom: 12,
  },
}));
