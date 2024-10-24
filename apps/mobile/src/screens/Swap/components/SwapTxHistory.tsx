import { AppBottomSheetModal, AssetAvatar, Tip } from '@/components';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

import { SwapItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import RcPending from '@/assets/icons/swap/pending.svg';

import {
  RcIconSwapHistoryEmpty,
  RcIconSwapRightArrow,
} from '@/assets/icons/swap';
import { ModalLayouts } from '@/constant/layout';
import { openExternalUrl } from '@/core/utils/linking';
import { useThemeColors } from '@/hooks/theme';
import { ellipsis } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwapHistory, useSwapTxHistoryVisible } from '../hooks/history';
import { DEX } from '@/constant/swap';

const getStyles = createGetStyles(colors => ({
  contentContainerStyle: {
    // gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors['neutral-bg-2'],
    color: colors['neutral-title-1'],
  },
  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
    marginBottom: 12,
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
  container: {
    backgroundColor: colors['neutral-card-1'],
    borderRadius: 6,
    paddingTop: 12,
    paddingBottom: 14,
    fontSize: 12,
    marginBottom: 12,
  },
  textTokenLabel: {
    width: 68,
  },
  text: {
    fontSize: 14,
    lineHeight: 17,
    color: colors['neutral-body'],
    fontWeight: '400',
  },
  valueText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  timeText: {
    fontSize: 14,
    lineHeight: 17,
    color: colors['neutral-title-1'],
    fontWeight: '500',
  },
  dexText: {
    fontSize: 14,
    lineHeight: 17,
    color: colors['neutral-title-1'],
    fontWeight: '500',
  },
  pendingText: {
    color: colors['orange-default'],
    fontWeight: '500',
  },
  completedText: {
    color: colors['neutral-body'],
  },
  topBorder: {
    marginTop: 11,
    marginBottom: 19,
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors['neutral-line'],
  },
  list: {
    gap: 20,
  },
  bottomBorder: {
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors['neutral-line'],
  },
  itemContainer: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  itemBottomBorder: {
    borderBottomWidth: 1,
    borderColor: colors['neutral-line'],
  },
  itemText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors['neutral-title-1'],
  },
  detailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenText: {
    fontSize: 13,
    color: colors['neutral-title-1'],
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  footText: {
    fontSize: 12,
    lineHeight: 14,
    color: colors['neutral-foot'],
  },

  tokenContainer: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
  },
  tokenRow: {
    flexDirection: 'row',
  },
  tokenIcon: {
    minWidth: 16,
    marginRight: 6,
  },
  rightArrowIcon: {
    marginHorizontal: 12,
  },
  tokenTextValue: {
    color: colors['neutral-title-1'],
    flexWrap: 'wrap',
    marginLeft: 6,
    flex: 1,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '500',
  },
  skeleton: {
    flex: 1,
    height: 16,
    width: 80,
  },
}));
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
    <View
      style={[
        styles.tokenContainer,
        {
          opacity: actual ? 1 : 0.6,
        },
      ]}>
      <AssetAvatar
        size={16}
        chain={payToken.chain}
        logo={payToken.logo_url}
        chainSize={0}
        style={styles.tokenIcon}
      />
      <Text numberOfLines={1} style={styles.tokenTextValue}>
        {formatAmount(payTokenAmount || '0')} {getTokenSymbol(payToken)}
      </Text>
      <RcIconSwapRightArrow
        width={16}
        height={16}
        style={styles.rightArrowIcon}
      />
      <AssetAvatar
        size={16}
        chain={receiveToken.chain}
        logo={receiveToken.logo_url}
        chainSize={0}
      />
      <Text numberOfLines={1} style={styles.tokenTextValue}>
        {formatAmount(receiveTokenAmount || '0')} {getTokenSymbol(receiveToken)}
      </Text>
    </View>
  );
};

const Transaction = forwardRef<View, { data: SwapItem }>(({ data }, ref) => {
  const isPending = data.status === 'Pending';
  const isCompleted = data?.status === 'Completed';
  const time = data?.finished_at || data?.create_at;
  const targetDex = DEX?.[data?.dex_id]?.name || data?.dex_id;
  const txId = data?.tx_id;
  const chainItem = findChain({
    serverId: data?.chain,
  });
  const chainName = chainItem?.name || '';
  const scanLink = chainItem?.scanLink.replace('_s_', '');
  const loading = data?.status !== 'Finished';

  const gasUsed = data?.gas
    ? `${formatAmount(data.gas.native_gas_fee)} ${getTokenSymbol(
        data?.gas.native_token,
      )} (${formatUsdValue(data.gas.usd_gas_fee)})`
    : '';

  const gotoScan = () => {
    if (scanLink && txId) {
      openExternalUrl(scanLink + txId);
    }
  };

  const slippagePercent =
    new BigNumber(data.quote.slippage).times(100).toString(10) + '%';
  const actualSlippagePercent =
    new BigNumber(data?.actual?.slippage).times(100).toString(10) + '%';

  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
    <View style={styles.container} ref={ref}>
      <View style={styles.itemContainer}>
        {isPending && (
          <Tip content={t('page.swap.pendingTip')}>
            <View style={styles.detailContainer}>
              <Animated.View
                style={{
                  transform: [{ rotate: spin }],
                }}>
                <RcPending style={styles.arrowIcon} />
              </Animated.View>

              <Text style={[styles.text, styles.pendingText]}>
                {t('page.swap.Pending')}
              </Text>
            </View>
          </Tip>
        )}
        {isCompleted && (
          <Tip content={t('page.swap.completedTip')}>
            <TouchableWithoutFeedback style={styles.detailContainer}>
              {/* <Image source={ImgCompleted} style={styles.arrowIcon} /> */}
              <>
                <Image
                  source={{ uri: require('@/assets/icons/swap/completed.svg') }}
                  style={styles.arrowIcon}
                />
                <Text style={[styles.text, styles.completedText]}>
                  {t('page.swap.Completed')}
                </Text>
              </>
            </TouchableWithoutFeedback>
          </Tip>
        )}
        <Text style={styles.timeText}>{!isPending && sinceTime(time)}</Text>
        {!!targetDex && <Text style={styles.dexText}>{targetDex}</Text>}
      </View>
      <View style={styles.topBorder} />
      <View style={styles.list}>
        <View style={styles.itemContainer}>
          <Text style={[styles.text, styles.textTokenLabel]}>
            {t('page.swap.estimate')}
          </Text>
          <TokenCost
            payToken={data?.pay_token}
            receiveToken={data.receive_token}
            payTokenAmount={data.quote.pay_token_amount}
            receiveTokenAmount={data.quote.receive_token_amount}
          />
        </View>

        <View style={styles.itemContainer}>
          <Text style={[styles.text, styles.textTokenLabel]}>
            {t('page.swap.actual')}
          </Text>
          <TokenCost
            payToken={data?.pay_token}
            receiveToken={data.receive_token}
            payTokenAmount={data.actual.pay_token_amount}
            receiveTokenAmount={data.actual.receive_token_amount}
            loading={loading}
            actual
          />
        </View>
        <View style={styles.itemContainer}>
          <View
            style={[styles.itemContainer, { gap: 6, paddingHorizontal: 0 }]}>
            <Text style={styles.text}>{t('page.swap.slippage_tolerance')}</Text>
            <Text style={[styles.valueText, { opacity: 0.5 }]}>
              {slippagePercent}
            </Text>
          </View>

          <View
            style={[styles.itemContainer, { gap: 6, paddingHorizontal: 0 }]}>
            <Text style={styles.text}>{t('page.swap.actual-slippage')}</Text>
            {loading ? (
              <Skeleton style={{ width: 52, height: 18 }} />
            ) : (
              <Text style={styles.valueText}>{actualSlippagePercent}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bottomBorder} />

      <View style={styles.itemContainer}>
        <Text style={styles.footText} onPress={gotoScan}>
          {chainName}:{' '}
          <Text style={[styles.footText, { textDecorationLine: 'underline' }]}>
            {ellipsis(txId)}
          </Text>
        </Text>
        {!loading && (
          <Text style={styles.footText}>
            {t('page.swap.gas-fee', { gasUsed })}
          </Text>
        )}
      </View>
    </View>
  );
});

const HistoryList = () => {
  const { txList, loading, loadingMore, loadMore, noMore } = useSwapHistory();

  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const renderItem = useCallback(({ item }) => <Transaction data={item} />, []);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View>
        <Text style={styles.headerTitle}>Swap history</Text>
      </View>
    );
  }, [styles.headerTitle]);

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
        styles.contentContainerStyle,
        {
          paddingBottom: 20 + bottom,
        },
      ]}
      style={{
        paddingHorizontal: 20,
      }}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={ListHeaderComponent}
      data={txList?.list}
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
  const colors = useThemeColors();

  const onDismiss = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onDismiss}
      backgroundStyle={{
        backgroundColor: colors['neutral-bg-2'],
      }}
      handleStyle={{
        backgroundColor: colors['neutral-bg-2'],
      }}
      enableDismissOnClose>
      <HistoryList />
    </AppBottomSheetModal>
  );
};
