import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import type { Account } from '@/core/startupServices/preference';
import { executePerpsSpotOrder } from '@/hooks/perps/spot/spotActions';
import {
  formatSpotLimitPrice,
  formatSpotPrice,
  formatSpotQuoteAmount,
  formatSpotSize,
  getSpotMarketOrderPrice,
  getSpotMaxQuoteAmount,
  getSpotMaxSize,
  getSpotSizeFromAmount,
  getSpotTokenBalance,
  SPOT_MARKET_SLIPPAGE,
  SPOT_MIN_ORDER_NOTIONAL,
  SPOT_PRICE_MAX_AGE_MS,
  validateSpotOrder,
  type SpotAmountUnit,
  type SpotBalance,
  type SpotMarket,
  type SpotOrderSide,
  type SpotOrderType,
} from '@/hooks/perps/spot/spotMarkets';
import { useTheme2024 } from '@/hooks/theme';
import { PerpsSlider } from '@/screens/PerpsMarketDetail/components/PerpsSlider';
import { createGetStyles2024 } from '@/utils/styles';

const DECIMAL_INPUT_RE = /^\d*\.?\d*$/;
const QUICK_PCTS = [25, 50, 75, 100] as const;
const SHEET_BASE_HEIGHT = 540;
const SHEET_LIMIT_EXTRA_HEIGHT = 84;

const sanitizeDecimalInput = (text: string) => {
  const normalized = text.replace(',', '.');
  return DECIMAL_INPUT_RE.test(normalized) ? normalized : null;
};

const roundAmount = (
  value: BigNumber.Value,
  unit: SpotAmountUnit,
  szDecimals: number,
) =>
  unit === 'base'
    ? formatSpotSize(value, szDecimals)
    : formatSpotQuoteAmount(value);

/**
 * Bottom sheet placing one spot order on `market`. Same validation and
 * submit guards as the former full-screen form: slippage-bounded market
 * orders, limit prices rounded toward the passive side, stale-price refusal
 * and a synchronous double-submit lock.
 */
export const SpotOrderSheet: React.FC<{
  visible: boolean;
  side: SpotOrderSide;
  market: SpotMarket;
  balances: ReadonlyArray<SpotBalance> | null;
  midsUpdatedAt: number;
  currentPerpsAccount: Account | null;
  /** False when the region gate or login forbids trading. */
  canTrade: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  refreshPrices: () => void;
}> = ({
  visible,
  side,
  market,
  balances,
  midsUpdatedAt,
  currentPerpsAccount,
  canTrade,
  onClose,
  onSubmitted,
  refreshPrices,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const [orderType, setOrderType] = useState<SpotOrderType>('market');
  const [unit, setUnit] = useState<SpotAmountUnit>('quote');
  const [amount, setAmount] = useState('');
  const [limitPx, setLimitPx] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Mid timestamp a market order was refused at; cleared by the next poll.
  const [stalePriceAt, setStalePriceAt] = useState<number | null>(null);
  const submitLockRef = useRef(false);

  const { szDecimals, midPx } = market;
  const isBuy = side === 'buy';
  const baseAvailable = getSpotTokenBalance(
    balances,
    market.baseTokenIndex,
  ).available;
  const quoteAvailable = getSpotTokenBalance(
    balances,
    market.quoteTokenIndex,
  ).available;
  // Latest inputs for the order built after the agent approval, which can
  // take minutes on a hardware wallet while the mid keeps moving.
  const latestRef = useRef({
    midPx,
    midsUpdatedAt,
    baseAvailable,
    quoteAvailable,
    amount,
    unit,
    limitPx,
    orderType,
  });
  latestRef.current = {
    midPx,
    midsUpdatedAt,
    baseAvailable,
    quoteAvailable,
    amount,
    unit,
    limitPx,
    orderType,
  };

  useEffect(() => {
    if (visible) {
      setOrderType('market');
      setUnit(isBuy ? 'quote' : 'base');
      setAmount('');
      setLimitPx('');
      setStalePriceAt(null);
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible, isBuy]);

  // Price used for notional / balance checks. Market orders are checked at
  // the slippage-bounded limit so a buy never exceeds the available quote.
  const checkPrice = useMemo(() => {
    if (orderType === 'limit') {
      return limitPx ? formatSpotLimitPrice(limitPx, side, szDecimals) : '0';
    }
    return midPx ? getSpotMarketOrderPrice(midPx, side, szDecimals) : '0';
  }, [orderType, limitPx, midPx, side, szDecimals]);
  const hasCheckPrice = Number(checkPrice) > 0;
  // Conversion / display price: the mid for market orders (the IOC usually
  // fills near it), the limit otherwise. `checkPrice` stays the worst case
  // used for balance checks and the sent limit.
  const displayPrice =
    orderType === 'limit' ? (hasCheckPrice ? checkPrice : null) : midPx;

  const size = getSpotSizeFromAmount({
    amount,
    unit,
    price: displayPrice,
    szDecimals,
  });
  const quoteValue =
    displayPrice && Number(size) > 0
      ? new BigNumber(size).times(displayPrice)
      : null;

  const validationError = useMemo(
    () =>
      amount
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
      amount,
      side,
      size,
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

  const maxAmount = useMemo(
    () =>
      unit === 'base'
        ? getSpotMaxSize({
            side,
            price: checkPrice,
            szDecimals,
            baseAvailable,
            quoteAvailable,
          })
        : getSpotMaxQuoteAmount({
            side,
            price: displayPrice,
            baseAvailable,
            quoteAvailable,
            slippage: orderType === 'market' ? SPOT_MARKET_SLIPPAGE : 0,
          }),
    [
      unit,
      side,
      checkPrice,
      displayPrice,
      orderType,
      szDecimals,
      baseAvailable,
      quoteAvailable,
    ],
  );
  const sliderValue = useMemo(() => {
    const max = Number(maxAmount);
    const current = Number(amount);
    if (!(max > 0) || !(current > 0)) {
      return 0;
    }
    return Math.min(100, Math.round((current / max) * 100));
  }, [amount, maxAmount]);

  const applyPct = useCallback(
    (pct: number) => {
      if (!(Number(maxAmount) > 0)) {
        return;
      }
      const next = roundAmount(
        new BigNumber(maxAmount).times(pct).div(100),
        unit,
        szDecimals,
      );
      setAmount(Number(next) > 0 ? next : '');
    },
    [maxAmount, unit, szDecimals],
  );

  const toggleUnit = useCallback(() => {
    const nextUnit: SpotAmountUnit = unit === 'base' ? 'quote' : 'base';
    // Carry the typed amount over at the current price.
    if (amount && displayPrice) {
      const converted =
        nextUnit === 'quote'
          ? new BigNumber(amount).times(displayPrice)
          : new BigNumber(amount).div(displayPrice);
      const rounded = roundAmount(converted, nextUnit, szDecimals);
      setAmount(Number(rounded) > 0 ? rounded : '');
    }
    setUnit(nextUnit);
  }, [unit, amount, displayPrice, szDecimals]);

  const handleSubmit = useCallback(async () => {
    if (
      validationError ||
      !amount ||
      !(Number(size) > 0) ||
      submitLockRef.current
    ) {
      return;
    }
    if (
      orderType === 'market' &&
      Date.now() - midsUpdatedAt > SPOT_PRICE_MAX_AGE_MS
    ) {
      setStalePriceAt(midsUpdatedAt);
      refreshPrices();
      return;
    }
    Keyboard.dismiss();
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      // Re-price and re-validate from the latest poll right before signing:
      // the approval step may have taken a while.
      const buildParams = () => {
        const latest = latestRef.current;
        if (
          latest.orderType === 'market' &&
          Date.now() - latest.midsUpdatedAt > SPOT_PRICE_MAX_AGE_MS
        ) {
          setStalePriceAt(latest.midsUpdatedAt);
          refreshPrices();
          return null;
        }
        const price =
          latest.orderType === 'limit'
            ? formatSpotLimitPrice(latest.limitPx, side, szDecimals)
            : latest.midPx
            ? getSpotMarketOrderPrice(latest.midPx, side, szDecimals)
            : '0';
        const conversionPrice =
          latest.orderType === 'limit' ? price : latest.midPx;
        const nextSize = getSpotSizeFromAmount({
          amount: latest.amount,
          unit: latest.unit,
          price: Number(conversionPrice) > 0 ? conversionPrice : null,
          szDecimals,
        });
        const error = validateSpotOrder({
          side,
          size: nextSize,
          price,
          szDecimals,
          baseAvailable: latest.baseAvailable,
          quoteAvailable: latest.quoteAvailable,
          midPx: latest.midPx,
          orderType: latest.orderType,
        });
        if (error) {
          return null;
        }
        return {
          pairIndex: market.pairIndex,
          side,
          type: latest.orderType,
          size: nextSize,
          limitPx: price,
        };
      };
      const result = await executePerpsSpotOrder(
        currentPerpsAccount,
        market.pairIndex,
        buildParams,
      );
      if (result) {
        onSubmitted();
        onClose();
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [
    validationError,
    amount,
    size,
    orderType,
    midsUpdatedAt,
    refreshPrices,
    currentPerpsAccount,
    market.pairIndex,
    side,
    szDecimals,
    onSubmitted,
    onClose,
  ]);

  const unitName = unit === 'base' ? market.baseName : market.quoteName;
  const otherUnitName = unit === 'base' ? market.quoteName : market.baseName;
  const convertedText =
    Number(size) > 0
      ? unit === 'base'
        ? `≈ ${quoteValue ? quoteValue.toFixed(2) : '-'} ${market.quoteName}`
        : `≈ ${size} ${market.baseName}`
      : '';
  const availableText = isBuy
    ? `${new BigNumber(quoteAvailable).toFixed(2, BigNumber.ROUND_DOWN)} ${
        market.quoteName
      }`
    : `${formatSpotSize(baseAvailable, szDecimals)} ${market.baseName}`;
  const receiveText = isBuy
    ? Number(size) > 0
      ? `${orderType === 'market' ? '≈ ' : ''}${size} ${market.baseName}`
      : '-'
    : quoteValue
    ? `${orderType === 'market' ? '≈ ' : ''}${quoteValue.toFixed(2)} ${
        market.quoteName
      }`
    : '-';
  const errorText = orderError
    ? t(`page.perpsSpot.error.${orderError}`, {
        min: SPOT_MIN_ORDER_NOTIONAL,
        quote: market.quoteName,
      })
    : '';
  const sheetHeight = Math.min(
    windowHeight - 80,
    SHEET_BASE_HEIGHT +
      (orderType === 'limit' ? SHEET_LIMIT_EXTRA_HEIGHT : 0) +
      bottom,
  );
  const submitTitle =
    Number(size) > 0
      ? t(
          isBuy
            ? 'page.perpsSpot.submitBuySize'
            : 'page.perpsSpot.submitSellSize',
          {
            size,
            base: market.baseName,
          },
        )
      : t(isBuy ? 'page.perpsSpot.submitBuy' : 'page.perpsSpot.submitSell', {
          base: market.baseName,
        });

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      snapPoints={[sheetHeight]}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore">
      <AutoLockView style={styles.container}>
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {t(
                isBuy
                  ? 'page.perpsSpot.submitBuy'
                  : 'page.perpsSpot.submitSell',
                {
                  base: market.baseName,
                },
              )}
            </Text>
            <Text style={styles.titlePrice}>
              {t('page.perpsSpot.price')}{' '}
              <Text style={styles.titlePriceValue}>
                {midPx ? formatSpotPrice(midPx, szDecimals) : '-'}
              </Text>
            </Text>
          </View>

          <View style={styles.segment}>
            {(['market', 'limit'] as const).map(item => {
              const active = item === orderType;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.segmentItem,
                    active && styles.segmentItemActive,
                  ]}
                  onPress={() => {
                    setOrderType(item);
                    if (item === 'limit' && !limitPx && midPx) {
                      setLimitPx(formatSpotPrice(midPx, szDecimals));
                    }
                  }}>
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

          {orderType === 'limit' && (
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  {t('page.perpsSpot.limitPrice', { quote: market.quoteName })}
                </Text>
                <TouchableOpacity
                  hitSlop={8}
                  disabled={!midPx}
                  onPress={() =>
                    midPx && setLimitPx(formatSpotPrice(midPx, szDecimals))
                  }>
                  <Text style={styles.linkText}>{t('page.perpsSpot.mid')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputBox}>
                <BottomSheetTextInput
                  style={styles.limitInput}
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
            </View>
          )}

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t('page.perpsSpot.amount')}</Text>
              <Text style={styles.label}>
                {t('page.perpsSpot.available')}{' '}
                <Text style={styles.labelStrong}>
                  {balances ? availableText : '-'}
                </Text>
              </Text>
            </View>
            <View
              style={[styles.inputBox, !!orderError && styles.inputBoxError]}>
              <BottomSheetTextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors2024['neutral-info']}
                value={amount}
                onChangeText={text => {
                  const next = sanitizeDecimalInput(text);
                  if (next !== null) {
                    setAmount(next);
                  }
                }}
              />
              <TouchableOpacity
                style={styles.unitToggle}
                hitSlop={6}
                onPress={toggleUnit}
                accessibilityLabel={t('page.perpsSpot.switchUnit', {
                  unit: otherUnitName,
                })}>
                <Text style={styles.unitToggleText}>{unitName}</Text>
                <Text style={styles.unitToggleArrow}>⇅</Text>
              </TouchableOpacity>
            </View>
            {!!convertedText && (
              <Text style={styles.converted}>{convertedText}</Text>
            )}
          </View>

          <View style={styles.sliderWrap}>
            <PerpsSlider
              value={sliderValue}
              onValueChange={applyPct}
              step={1}
              disabled={!(Number(maxAmount) > 0)}
            />
          </View>
          <View style={styles.pctRow}>
            {QUICK_PCTS.map(pct => (
              <TouchableOpacity
                key={pct}
                style={styles.pctChip}
                onPress={() => applyPct(pct)}>
                <Text style={styles.pctChipText}>
                  {pct === 100 ? t('page.perpsSpot.max') : `${pct}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.mutedText}>
              {t('page.perpsSpot.estReceive')}
            </Text>
            <Text style={styles.infoValue}>{receiveText}</Text>
          </View>
          {orderType === 'market' && (
            <View style={styles.infoRow}>
              <Text style={styles.mutedText}>
                {t('page.perpsSpot.maxSlippage')}
              </Text>
              <Text style={styles.infoValue}>
                {`${SPOT_MARKET_SLIPPAGE * 100}%`}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.mutedText}>{t('page.perpsSpot.minOrder')}</Text>
            <Text style={styles.infoValue}>
              {`${SPOT_MIN_ORDER_NOTIONAL} ${market.quoteName}`}
            </Text>
          </View>
          {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
          {!currentPerpsAccount && (
            <Text style={styles.errorText}>
              {t('page.perpsSpot.loginRequired')}
            </Text>
          )}
        </BottomSheetScrollView>
        <View
          style={[
            styles.footer,
            { paddingBottom: getBottomButtonBottomOffset(bottom) },
          ]}>
          <Button
            type={isBuy ? 'success' : 'danger'}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            title={submitTitle}
            loading={submitting}
            disabled={
              !currentPerpsAccount ||
              !canTrade ||
              !amount ||
              !!orderError ||
              submitting ||
              !balances
            }
            onPress={handleSubmit}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  titlePrice: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  titlePriceValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 10,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentItemActive: { backgroundColor: colors2024['neutral-bg-1'] },
  segmentText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  segmentTextActive: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  field: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  labelStrong: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputBoxError: { borderColor: colors2024['red-default'] },
  amountInput: {
    flex: 1,
    padding: 0,
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  limitInput: {
    flex: 1,
    padding: 0,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  unitToggleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  unitToggleArrow: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  converted: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  sliderWrap: { paddingHorizontal: 4 },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctChip: {
    flex: 1,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  pctChipText: {
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
  infoValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
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
    paddingHorizontal: 20,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
