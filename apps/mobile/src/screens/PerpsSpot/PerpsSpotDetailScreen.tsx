import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { RcNextLeftCC } from '@/assets/icons/common';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
  RootNames,
} from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useSpotTokenLogos } from '@/hooks/perps/spot/spotLogos';
import {
  formatSpotPrice,
  formatSpotSize,
  getSpotFavoriteKey,
  getSpotMarket24hChange,
  getSpotTokenBalance,
  isSpotMarketFavorite,
  SPOT_MIN_ORDER_NOTIONAL,
  type SpotOrderSide,
} from '@/hooks/perps/spot/spotMarkets';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useSpotOrderCancel } from '@/hooks/perps/spot/useSpotOrderCancel';
import {
  SPOT_SPARKLINE_RANGES,
  useSpotSparkline,
  type SpotSparklineRange,
} from '@/hooks/perps/spot/useSpotSparkline';
import {
  addFavoriteMarket,
  perpsStore,
  removeFavoriteMarket,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { formatSpotPctChange } from './components/SpotMarketRow';
import { SpotOpenOrderRow } from './components/SpotOpenOrderRow';
import { SpotOrderSheet } from './components/SpotOrderSheet';
import { SpotSparkline } from './components/SpotSparkline';

const CONTENT_PADDING = 20;

/** Spot pair detail: price, chart, balances, open orders; Buy / Sell footer. */
export const PerpsSpotDetailScreen: React.FC = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsSpotTrade'
      >
    >();
  const { pairIndex, side: initialSide } = route.params;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const {
    markets,
    midsUpdatedAt,
    isLoading,
    account,
    currentPerpsAccount,
    refresh,
  } = usePerpsSpotData({ withAccount: true });
  const market = useMemo(
    () => markets.find(item => item.pairIndex === pairIndex) ?? null,
    [markets, pairIndex],
  );
  const marketList = useMemo(() => (market ? [market] : []), [market]);
  const logos = useSpotTokenLogos(marketList);
  const favoriteMarkets = perpsStore(s => s.favoriteMarkets);
  const isFavorite = !!market && isSpotMarketFavorite(favoriteMarkets, market);

  const [range, setRange] = useState<SpotSparklineRange>('1d');
  const sparkline = useSpotSparkline(market?.coin ?? null, range);
  // The sheet keeps its own form state; `sheetSide` null means closed.
  const [sheetSide, setSheetSide] = useState<SpotOrderSide | null>(
    initialSide ?? null,
  );
  const { cancel, cancellingOid } = useSpotOrderCancel(
    currentPerpsAccount,
    refresh,
  );

  const marketOrders = useMemo(
    () =>
      market
        ? (account?.openOrders ?? []).filter(o => o.coin === market.coin)
        : [],
    [account?.openOrders, market],
  );

  const handleCancel = useCallback(
    (target: { pairIndex: number }, order: { oid: number }) =>
      cancel(target.pairIndex, order.oid),
    [cancel],
  );
  const handleToggleFavorite = useCallback(() => {
    if (!market) {
      return;
    }
    const key = getSpotFavoriteKey(market);
    if (isFavorite) {
      removeFavoriteMarket(key);
    } else {
      addFavoriteMarket(key);
    }
  }, [market, isFavorite]);
  const handleOpenPortfolio = useCallback(() => {
    naviPush(RootNames.StackTransaction, { screen: RootNames.PerpsSpotOrders });
  }, []);
  const closeSheet = useCallback(() => setSheetSide(null), []);

  if (!market) {
    return (
      <NormalScreenContainer2024 noHeader type="bg1">
        <View style={styles.header}>
          <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
            <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          {isLoading ? (
            <ActivityIndicator color={colors2024['neutral-foot']} />
          ) : (
            <Text style={styles.mutedText}>{t('page.perpsSpot.empty')}</Text>
          )}
        </View>
      </NormalScreenContainer2024>
    );
  }

  const { szDecimals, midPx } = market;
  const change = getSpotMarket24hChange(market);
  const changeAbs =
    change !== null && midPx && market.prevDayPx
      ? new BigNumber(midPx).minus(market.prevDayPx)
      : null;
  const changeStyle =
    change === null || change === 0
      ? styles.changeMuted
      : change > 0
      ? styles.changeUp
      : styles.changeDown;
  const baseBalance = getSpotTokenBalance(
    account?.balances,
    market.baseTokenIndex,
  );
  const quoteBalance = getSpotTokenBalance(
    account?.balances,
    market.quoteTokenIndex,
  );
  const baseUsd =
    midPx && Number(baseBalance.total) > 0
      ? new BigNumber(baseBalance.total).times(midPx).toFixed(2)
      : null;

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <AssetAvatar
            logo={logos[market.baseName] || ''}
            size={28}
            logoStyle={styles.avatar}
          />
          <Text style={styles.headerTitle}>
            {market.baseName}
            <Text style={styles.headerQuote}>{` / ${market.quoteName}`}</Text>
          </Text>
        </View>
        <TouchableOpacity
          hitSlop={10}
          onPress={handleToggleFavorite}
          accessibilityLabel={t(
            isFavorite
              ? 'page.perpsSpot.removeFavorite'
              : 'page.perpsSpot.addFavorite',
          )}>
          <RcIconFavorite
            width={22}
            height={22}
            color={
              isFavorite
                ? colors2024['orange-default']
                : colors2024['neutral-info']
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>
            {midPx ? formatSpotPrice(midPx, szDecimals) : '-'}
          </Text>
          <Text style={[styles.change, changeStyle]}>
            {changeAbs
              ? `${changeAbs.gte(0) ? '+' : '-'}${formatSpotPrice(
                  changeAbs.abs(),
                  szDecimals,
                )} (${formatSpotPctChange(change)})`
              : formatSpotPctChange(change)}
            <Text style={styles.changeSuffix}>
              {`  ${t('page.perpsSpot.change24h')}`}
            </Text>
          </Text>
        </View>

        <SpotSparkline
          closes={sparkline.closes}
          isLoading={sparkline.isLoading}
          width={width - CONTENT_PADDING * 2}
        />
        <View style={styles.rangeRow}>
          {SPOT_SPARKLINE_RANGES.map(item => {
            const active = item === range;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
                onPress={() => setRange(item)}>
                <Text
                  style={[
                    styles.rangeChipText,
                    active && styles.rangeChipTextActive,
                  ]}>
                  {t(`page.perpsSpot.range.${item}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!currentPerpsAccount && (
          <View style={styles.balanceCard}>
            <Text style={styles.cardTitle}>
              {t('page.perpsSpot.yourBalances')}
            </Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoStrong}>
                {`${formatSpotSize(baseBalance.total, szDecimals)} ${
                  market.baseName
                }`}
              </Text>
              <Text style={styles.mutedText}>
                {baseUsd ? `≈ ${baseUsd} ${market.quoteName}` : '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoStrong}>
                {`${new BigNumber(quoteBalance.available).toFixed(
                  2,
                  BigNumber.ROUND_DOWN,
                )} ${market.quoteName}`}
              </Text>
              <Text style={styles.mutedText}>
                {t('page.perpsSpot.availableSuffix')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('page.perpsSpot.openOrders')}
            {marketOrders.length > 0 && (
              <Text
                style={styles.sectionCount}>{`  ${marketOrders.length}`}</Text>
            )}
          </Text>
          {!!currentPerpsAccount && (
            <TouchableOpacity hitSlop={8} onPress={handleOpenPortfolio}>
              <Text style={styles.linkText}>
                {t('page.perpsSpot.allOrders')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {marketOrders.length === 0 ? (
          <Text style={styles.mutedText}>
            {t('page.perpsSpot.noOpenOrders')}
          </Text>
        ) : (
          <View style={styles.ordersCard}>
            {marketOrders.map(order => (
              <SpotOpenOrderRow
                key={order.oid}
                order={order}
                market={market}
                cancelling={cancellingOid === order.oid}
                cancelDisabled={cancellingOid !== null}
                onCancel={handleCancel}
              />
            ))}
          </View>
        )}

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.mutedText}>
              {t('page.perpsSpot.volume24h')}
            </Text>
            <Text style={styles.infoValue}>
              {market.dayNtlVlm
                ? `$${formatUsdValueKMB(market.dayNtlVlm)}`
                : '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.mutedText}>{t('page.perpsSpot.minOrder')}</Text>
            <Text style={styles.infoValue}>
              {`${SPOT_MIN_ORDER_NOTIONAL} ${market.quoteName}`}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.mutedText}>
              {t('page.perpsSpot.precision')}
            </Text>
            <Text style={styles.infoValue}>
              {`${new BigNumber(10).pow(-szDecimals).toFixed()} ${
                market.baseName
              }`}
            </Text>
          </View>
        </View>
        {!currentPerpsAccount && (
          <Text style={styles.errorText}>
            {t('page.perpsSpot.loginRequired')}
          </Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: getBottomButtonBottomOffset(bottom) },
        ]}>
        <View style={styles.footerBtn}>
          <Button
            type="success"
            height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            title={t('page.perpsSpot.buy')}
            disabled={!currentPerpsAccount}
            onPress={() => setSheetSide('buy')}
          />
        </View>
        <View style={styles.footerBtn}>
          <Button
            type="danger"
            height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            title={t('page.perpsSpot.sell')}
            disabled={!currentPerpsAccount}
            onPress={() => setSheetSide('sell')}
          />
        </View>
      </View>

      <SpotOrderSheet
        visible={sheetSide !== null}
        side={sheetSide ?? 'buy'}
        market={market}
        balances={account?.balances ?? null}
        midsUpdatedAt={midsUpdatedAt}
        currentPerpsAccount={currentPerpsAccount}
        onClose={closeSheet}
        onSubmitted={refresh}
        refreshPrices={refresh}
      />
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingLeft: 14,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: { backgroundColor: colors2024['neutral-bg-2'] },
  headerTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  headerQuote: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  content: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  priceBlock: { gap: 2 },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  change: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  changeUp: { color: colors2024['green-default'] },
  changeDown: { color: colors2024['red-default'] },
  changeMuted: { color: colors2024['neutral-secondary'] },
  changeSuffix: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  rangeChipActive: { backgroundColor: colors2024['neutral-title-1'] },
  rangeChipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  rangeChipTextActive: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-bg-1'],
  },
  balanceCard: {
    borderRadius: 14,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  cardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoStrong: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  infoValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  sectionCount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  ordersCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 14,
  },
  infoList: { gap: 8 },
  mutedText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  errorText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['red-default'],
  },
  footer: {
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
    paddingHorizontal: 16,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  footerBtn: { flex: 1 },
}));
