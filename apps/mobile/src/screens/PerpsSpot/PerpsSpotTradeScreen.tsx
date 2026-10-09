import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { RcNextLeftCC } from '@/assets/icons/common';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  cancelPerpsSpotOrder,
  executePerpsSpotOrder,
} from '@/hooks/perps/spot/spotActions';
import {
  formatSpotLimitPrice,
  formatSpotPrice,
  formatSpotSize,
  getSpotMarketDisplayName,
  getSpotMarketOrderPrice,
  getSpotMaxSize,
  SPOT_MARKET_SLIPPAGE,
  SPOT_MIN_ORDER_NOTIONAL,
  SPOT_PRICE_MAX_AGE_MS,
  validateSpotOrder,
  type SpotOrderSide,
  type SpotOrderType,
} from '@/hooks/perps/spot/spotMarkets';
import { usePerpsSpotData } from '@/hooks/perps/spot/usePerpsSpotData';
import { useTheme2024 } from '@/hooks/theme';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';

const DECIMAL_INPUT_RE = /^\d*\.?\d*$/;

const sanitizeDecimalInput = (text: string) => {
  const normalized = text.replace(',', '.');
  return DECIMAL_INPUT_RE.test(normalized) ? normalized : null;
};

export const PerpsSpotTradeScreen: React.FC = () => {
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

  const [side, setSide] = useState<SpotOrderSide>(initialSide ?? 'buy');
  const [orderType, setOrderType] = useState<SpotOrderType>('market');
  const [size, setSize] = useState('');
  const [limitPx, setLimitPx] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  // Mid timestamp a market order was refused at; cleared by the next poll.
  const [stalePriceAt, setStalePriceAt] = useState<number | null>(null);
  // Synchronous locks: state updates land a render late, so a fast double tap
  // would otherwise sign two orders.
  const submitLockRef = useRef(false);
  const cancelLockRef = useRef(false);

  const szDecimals = market?.szDecimals ?? 0;
  const midPx = market?.midPx ?? null;

  const getAvailable = useCallback(
    (tokenIndex?: number) => {
      const balance = account?.balances.find(b => b.token === tokenIndex);
      if (!balance) {
        return '0';
      }
      const available = new BigNumber(balance.total || 0).minus(
        balance.hold || 0,
      );
      return available.gt(0) ? available.toFixed() : '0';
    },
    [account?.balances],
  );
  const baseAvailable = getAvailable(market?.baseTokenIndex);
  const quoteAvailable = getAvailable(market?.quoteTokenIndex);

  // Price used for notional / balance checks. Market orders are checked at
  // the slippage-bounded limit so a buy never exceeds the available quote.
  const checkPrice = useMemo(() => {
    if (orderType === 'limit') {
      return limitPx ? formatSpotLimitPrice(limitPx, side, szDecimals) : '0';
    }
    return midPx ? getSpotMarketOrderPrice(midPx, side, szDecimals) : '0';
  }, [orderType, limitPx, midPx, side, szDecimals]);

  const roundedSize = formatSpotSize(size || 0, szDecimals);
  const orderValue = new BigNumber(roundedSize).times(
    orderType === 'market' && midPx ? midPx : checkPrice,
  );

  const validationError = useMemo(
    () =>
      size
        ? validateSpotOrder({
            side,
            size,
            price: checkPrice,
            szDecimals,
            baseAvailable,
            quoteAvailable,
            midPx,
            orderType,
          })
        : null,
    [
      size,
      side,
      checkPrice,
      szDecimals,
      baseAvailable,
      quoteAvailable,
      midPx,
      orderType,
    ],
  );
  const orderError =
    validationError ??
    (stalePriceAt !== null && stalePriceAt === midsUpdatedAt
      ? 'stalePrice'
      : null);

  const handleMax = useCallback(() => {
    const max = getSpotMaxSize({
      side,
      price: checkPrice,
      szDecimals,
      baseAvailable,
      quoteAvailable,
    });
    setSize(max === '0' ? '' : max);
  }, [side, checkPrice, szDecimals, baseAvailable, quoteAvailable]);

  const handleSubmit = useCallback(async () => {
    if (!market || validationError || !size || submitLockRef.current) {
      return;
    }
    if (
      orderType === 'market' &&
      Date.now() - midsUpdatedAt > SPOT_PRICE_MAX_AGE_MS
    ) {
      setStalePriceAt(midsUpdatedAt);
      refresh();
      return;
    }
    Keyboard.dismiss();
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await executePerpsSpotOrder(currentPerpsAccount, {
        pairIndex: market.pairIndex,
        side,
        type: orderType,
        size: roundedSize,
        limitPx: checkPrice,
      });
      if (result) {
        setSize('');
        refresh();
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [
    market,
    validationError,
    size,
    midsUpdatedAt,
    currentPerpsAccount,
    side,
    orderType,
    roundedSize,
    checkPrice,
    refresh,
  ]);

  const handleCancel = useCallback(
    async (oid: number) => {
      if (!market || cancelLockRef.current) {
        return;
      }
      cancelLockRef.current = true;
      setCancellingOid(oid);
      try {
        const ok = await cancelPerpsSpotOrder(currentPerpsAccount, {
          pairIndex: market.pairIndex,
          oid,
        });
        if (ok) {
          refresh();
        }
      } finally {
        cancelLockRef.current = false;
        setCancellingOid(null);
      }
    },
    [market, currentPerpsAccount, refresh],
  );

  const marketOrders = useMemo(
    () =>
      market
        ? (account?.openOrders ?? []).filter(o => o.coin === market.coin)
        : [],
    [account?.openOrders, market],
  );

  if (!market) {
    return (
      <NormalScreenContainer2024 noHeader type="bg1">
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

  const isBuy = side === 'buy';
  const availableLabel = isBuy
    ? `${new BigNumber(quoteAvailable).toFixed(2, BigNumber.ROUND_DOWN)} ${
        market.quoteName
      }`
    : `${formatSpotSize(baseAvailable, szDecimals)} ${market.baseName}`;
  const errorText = orderError
    ? t(`page.perpsSpot.error.${orderError}`, {
        min: SPOT_MIN_ORDER_NOTIONAL,
        quote: market.quoteName,
      })
    : '';

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={() => navigation.goBack()}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            {getSpotMarketDisplayName(market)}
          </Text>
          <Text style={styles.headerPrice}>
            {midPx ? formatSpotPrice(midPx, szDecimals) : '-'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          {(['buy', 'sell'] as const).map(item => {
            const active = item === side;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.segmentItem,
                  active &&
                    (item === 'buy' ? styles.buyActive : styles.sellActive),
                ]}
                onPress={() => setSide(item)}>
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}>
                  {t(`page.perpsSpot.${item}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.typeRow}>
          {(['market', 'limit'] as const).map(item => (
            <TouchableOpacity
              key={item}
              hitSlop={8}
              onPress={() => {
                setOrderType(item);
                if (item === 'limit' && !limitPx && midPx) {
                  setLimitPx(formatSpotPrice(midPx, szDecimals));
                }
              }}>
              <Text
                style={[
                  styles.typeText,
                  item === orderType && styles.typeTextActive,
                ]}>
                {t(`page.perpsSpot.${item}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {orderType === 'limit' && (
          <View style={styles.field}>
            <Text style={styles.label}>
              {t('page.perpsSpot.limitPrice', { quote: market.quoteName })}
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors2024['neutral-info']}
              value={limitPx}
              onBlur={() => {
                // Show the price that will actually be sent.
                if (limitPx) {
                  const rounded = formatSpotLimitPrice(
                    limitPx,
                    side,
                    szDecimals,
                  );
                  setLimitPx(rounded === '0' ? '' : rounded);
                }
              }}
              onChangeText={text => {
                const next = sanitizeDecimalInput(text);
                if (next !== null) {
                  setLimitPx(next);
                }
              }}
            />
          </View>
        )}

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {t('page.perpsSpot.amount', { base: market.baseName })}
            </Text>
            <TouchableOpacity hitSlop={8} onPress={handleMax}>
              <Text style={styles.maxText}>{t('page.perpsSpot.max')}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, !!orderError && styles.inputError]}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors2024['neutral-info']}
            value={size}
            onChangeText={text => {
              const next = sanitizeDecimalInput(text);
              if (next !== null) {
                setSize(next);
              }
            }}
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.mutedText}>{t('page.perpsSpot.available')}</Text>
          <Text style={styles.infoValue}>{account ? availableLabel : '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.mutedText}>{t('page.perpsSpot.orderValue')}</Text>
          <Text style={styles.infoValue}>
            {orderValue.isFinite() && orderValue.gt(0)
              ? `${orderValue.toFixed(2)} ${market.quoteName}`
              : '-'}
          </Text>
        </View>
        {orderType === 'market' && (
          <Text style={styles.tip}>
            {t('page.perpsSpot.marketOrderTip', {
              slippage: SPOT_MARKET_SLIPPAGE * 100,
            })}
          </Text>
        )}
        {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
        {!currentPerpsAccount && (
          <Text style={styles.errorText}>
            {t('page.perpsSpot.loginRequired')}
          </Text>
        )}

        <Text style={styles.sectionTitle}>
          {t('page.perpsSpot.openOrders')}
        </Text>
        {marketOrders.length === 0 ? (
          <Text style={styles.mutedText}>
            {t('page.perpsSpot.noOpenOrders')}
          </Text>
        ) : (
          marketOrders.map(order => (
            <View key={order.oid} style={styles.orderRow}>
              <View>
                <Text
                  style={[
                    styles.orderSide,
                    order.side === 'B' ? styles.buyText : styles.sellText,
                  ]}>
                  {t(`page.perpsSpot.${order.side === 'B' ? 'buy' : 'sell'}`)}
                </Text>
                <Text style={styles.mutedText}>
                  {`${order.sz} ${market.baseName} @ ${order.limitPx}`}
                </Text>
              </View>
              <TouchableOpacity
                disabled={cancellingOid !== null}
                onPress={() => handleCancel(order.oid)}>
                {cancellingOid === order.oid ? (
                  <ActivityIndicator color={colors2024['neutral-foot']} />
                ) : (
                  <Text style={styles.cancelText}>
                    {t('page.perpsSpot.cancel')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: getBottomButtonBottomOffset(bottom) },
        ]}>
        <Button
          type={isBuy ? 'success' : 'danger'}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          title={t(
            isBuy ? 'page.perpsSpot.submitBuy' : 'page.perpsSpot.submitSell',
            { base: market.baseName },
          )}
          loading={submitting}
          disabled={
            !currentPerpsAccount ||
            !size ||
            !!orderError ||
            submitting ||
            !account
          }
          onPress={handleSubmit}
        />
      </View>
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
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  headerPrice: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  buyActive: { backgroundColor: colors2024['green-default'] },
  sellActive: { backgroundColor: colors2024['red-default'] },
  segmentText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
  segmentTextActive: { color: colors2024['neutral-bg-1'] },
  typeRow: { flexDirection: 'row', gap: 20 },
  typeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors2024['neutral-foot'],
  },
  typeTextActive: { color: colors2024['neutral-title-1'] },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  maxText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  input: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: colors2024['red-default'] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors2024['neutral-title-1'],
  },
  mutedText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  tip: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  errorText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['red-default'],
  },
  sectionTitle: {
    marginTop: 12,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  orderSide: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  buyText: { color: colors2024['green-default'] },
  sellText: { color: colors2024['red-default'] },
  cancelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors2024['brand-default'],
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
