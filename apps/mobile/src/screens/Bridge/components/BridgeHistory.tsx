import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useBridgeHistory } from '../hooks';
import { findChain } from '@/utils/chain';
import { BridgeHistory, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { openExternalUrl } from '@/core/utils/linking';
import { sinceTime } from '@/utils/time';
import RcPending from '@/assets/icons/swap/pending.svg';
import { ellipsis } from '@/utils/address';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RcIconSwapHistoryEmpty,
  RcIconSwapRightArrow,
} from '@/assets/icons/swap';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';

const BridgeTokenIcon = ({ token }: { token: TokenItem }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const chain = useMemo(() => {
    const chainServerId = token.chain;
    return findChain({
      serverId: chainServerId,
    });
  }, [token]);

  return (
    <View style={styles.tokenIconContainer}>
      <Image style={styles.tokenIcon} source={{ uri: token.logo_url }} />
      <Image style={styles.chainIcon} source={{ uri: chain?.logo }} />
    </View>
  );
};

const TokenCost = ({
  payToken,
  receiveToken,
  payTokenAmount,
  receiveTokenAmount,
  loading = false,
  actual = false,
}: {
  payToken: TokenItem;
  receiveToken: TokenItem;
  payTokenAmount?: number;
  receiveTokenAmount?: number;
  loading?: boolean;
  actual?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return <Skeleton style={styles.skeleton} />;
  }
  return (
    <View style={styles.tokenCostContainer}>
      <BridgeTokenIcon token={payToken} />
      <Text style={styles.tokenText}>
        {formatAmount(payTokenAmount || '0')} {getTokenSymbol(payToken)}
      </Text>
      <RcIconSwapRightArrow
        width={16}
        height={16}
        style={{ marginHorizontal: 12 }}
      />
      <BridgeTokenIcon token={receiveToken} />
      <Text style={styles.tokenText}>
        {formatAmount(receiveTokenAmount || '0')} {getTokenSymbol(receiveToken)}
      </Text>
    </View>
  );
};

const Transaction = forwardRef<View, { data: BridgeHistory }>(
  ({ data }, ref) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const isPending = data.status === 'pending';
    const time = data?.create_at;
    const txId = data?.detail_url?.split('/').pop() || '';
    const loading = data?.status !== 'completed';
    const { t } = useTranslation();

    const gasUsed = useMemo(() => {
      if (data?.from_gas) {
        return `${formatAmount(data.from_gas.gas_amount)} ${getTokenSymbol(
          data?.from_gas.native_token,
        )} (${formatUsdValue(data.from_gas.usd_gas_fee)})`;
      }
      return '';
    }, [data?.from_gas]);

    const gotoScan = () => {
      if (data?.detail_url) {
        openExternalUrl(data?.detail_url);
      }
    };

    const spinValue = useRef(new Animated.Value(0)).current;
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    useEffect(() => {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <View style={styles.transactionContainer} ref={ref}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionTime}>
            {isPending ? (
              <View style={styles.pendingContainer}>
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}>
                  <RcPending width={14} height={14} />
                </Animated.View>
                <Text style={styles.pendingText}>
                  {t('page.bridge.Pending')}
                </Text>
              </View>
            ) : (
              <Text style={styles.time}>{sinceTime(time)}</Text>
            )}
          </View>
          <View style={styles.aggregatorContainer}>
            <Image
              source={{ uri: data.aggregator.logo_url }}
              style={styles.aggregatorLogo}
            />
            <Text style={styles.aggregatorName}>{data.aggregator.name}</Text>
            <Text style={styles.bridgeName}>
              {t('page.bridge.via-bridge', {
                bridge: data?.bridge?.name || '',
              })}
            </Text>
          </View>
        </View>

        <View style={styles.estimateContainer}>
          <Text style={styles.estimateLabel}>{t('page.bridge.estimate')}</Text>
          <TokenCost
            payToken={data?.from_token}
            receiveToken={data.to_token}
            payTokenAmount={data.quote.pay_token_amount}
            receiveTokenAmount={data.quote.receive_token_amount}
          />
        </View>

        <View style={styles.actualContainer}>
          <Text style={styles.actualLabel}>{t('page.bridge.actual')}</Text>
          <TokenCost
            payToken={data?.from_token}
            receiveToken={data.to_token}
            payTokenAmount={data.actual.pay_token_amount}
            receiveTokenAmount={data.actual.receive_token_amount}
            loading={loading}
            actual
          />
        </View>

        <View style={styles.transactionFooter}>
          <TouchableOpacity onPress={gotoScan}>
            <Text style={styles.transactionDetail} numberOfLines={1}>
              {t('page.bridge.detail-tx')}:{' '}
              <Text style={styles.transactionId}>
                {txId ? ellipsis(txId) : ''}
              </Text>
            </Text>
          </TouchableOpacity>
          <Text style={styles.gasFee} numberOfLines={1}>
            {!loading
              ? t('page.bridge.gas-fee', { gasUsed })
              : t('page.bridge.gas-x-price', {
                  price: data?.from_gas?.gas_price || '',
                })}
          </Text>
        </View>
      </View>
    );
  },
);

const HistoryList = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { txList, loading, loadMore, noMore } = useBridgeHistory();
  const { t } = useTranslation();

  const renderItem = useCallback(({ item }) => <Transaction data={item} />, []);

  const ListHeaderComponent = useCallback(() => {
    return <Text style={styles.headerTitle}>{t('page.bridge.history')}</Text>;
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

  return (
    <BottomSheetFlatList
      contentContainerStyle={[
        {
          gap: 12,
          paddingBottom: 20 + bottom,
          paddingHorizontal: 20,
        },
      ]}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={ListHeaderComponent}
      data={txList?.list}
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
  const colors = useThemeColors();
  const bottomRef = useRef<BottomSheetModalMethods>(null);

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
      handleStyle={{
        backgroundColor: colors['neutral-bg-2'],
      }}
      backgroundStyle={{
        backgroundColor: colors['neutral-bg-2'],
      }}>
      <HistoryList />
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  tokenIconContainer: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  tokenIcon: {
    width: 16,
    height: 16,
  },
  chainIcon: {
    width: 12,
    height: 12,
    position: 'absolute',
    right: -4,
    bottom: -4,
  },
  tokenCostContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  transactionContainer: {
    backgroundColor: colors['neutral-card-1'],
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(211, 216, 224, 1)', // Update as needed
  },
  transactionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(25, 41, 69, 1)', // Update as needed
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingIcon: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['orange-default'],
  },
  time: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  aggregatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aggregatorLogo: {
    width: 16,
    height: 16,
    borderRadius: 50,
  },
  aggregatorName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  bridgeName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-foot'],
  },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  estimateLabel: {
    width: 68,
    fontSize: 14,
    color: colors['neutral-body'],
  },
  actualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  actualLabel: {
    width: 68,
    fontSize: 14,
    color: colors['neutral-body'],
  },
  transactionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderColor: colors['neutral-line'],
    gap: 4,
  },
  transactionDetail: {
    fontSize: 13,
    color: colors['neutral-foot'],
  },
  transactionId: {
    textDecorationLine: 'underline',
  },
  gasFee: {
    textAlign: 'right',
    marginLeft: 'auto',
    fontSize: 13,
    color: colors['neutral-foot'],
    flex: 1,
    flexWrap: 'wrap',
  },
  emptyContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginTop: 112,
    marginBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors['neutral-foot'],
  },
  historyList: {
    maxHeight: 434,
    paddingBottom: 20,
  },
  sheetContainer: {
    paddingTop: 16,
    paddingBottom: 0,
  },
  sheetTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skeleton: {
    flex: 1,
    height: 16,
    width: 80,
  },
  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
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
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: colors['neutral-bg-2'],
    color: colors['neutral-title-1'],
  },
}));
