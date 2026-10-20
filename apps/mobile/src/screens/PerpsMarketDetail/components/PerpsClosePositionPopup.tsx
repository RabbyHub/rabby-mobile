import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeQuantitySummary } from './account/model';
import { SIMPLE_ACCOUNT_COLORS } from './account/visual';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { PerpsSlider } from './PerpsSlider';
import { MarketSlippage } from './MarketSlippage';
import { useMarketSlippage } from '../hooks/useMarketSlippage';
import { PerpEditLimitPriceTag } from './PerpEditLimitPriceTag';
import IconOrderTypeSwitch from '@/assets2024/icons/perps/PerpsSimpleAccount/order-type-switch.svg';
import { formatTpOrSlPrice, isMarketableLimit } from '@/utils/perps';
import {
  PERPS_MINI_USD_VALUE,
  type PerpsOpenOrderType,
} from '@/constant/perps';
import { Text } from '@/components/Typography';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

export const PerpsClosePositionPopup: React.FC<{
  visible?: boolean;
  coin: string;
  displayName?: string;
  direction: 'Long' | 'Short';
  positionSize: string;
  marginUsed: number;
  markPrice: number;
  entryPrice: number;
  szDecimals: number;
  quoteAsset?: string;
  providerFee: number;
  pnl: number;
  onCancel: () => void;
  onConfirm: () => void;
  handleClosePosition: (params: {
    closePercent: number;
    orderType: PerpsOpenOrderType;
    limitPx?: string;
  }) => Promise<void>;
}> = ({
  visible,
  coin,
  displayName = coin,
  direction,
  positionSize,
  pnl,
  markPrice,
  entryPrice,
  szDecimals,
  quoteAsset = 'USDC',
  onCancel,
  onConfirm,
  handleClosePosition,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const [loading, setLoading] = useState<boolean>(false);
  const [closePercent, setClosePercent] = useState<number>(100);
  const [orderType, setOrderType] = useState<PerpsOpenOrderType>('market');
  const [limitPx, setLimitPx] = useState<string>('');

  const closePosition = useMemoizedFn(async () => {
    setLoading(true);
    try {
      await handleClosePosition({
        closePercent,
        orderType,
        limitPx: orderType === 'limit' ? limitPx : undefined,
      });
      onConfirm();
    } finally {
      setLoading(false);
    }
  });

  // User's intended exit price: limitPx in limit mode, markPrice otherwise
  // (also the fallback during transient empty limitPx). Mirrors the open
  // popup's effectivePx; estimates below use estimatePx instead.
  const effectivePx = useMemo(() => {
    if (orderType === 'limit' && limitPx && Number(limitPx) > 0) {
      return Number(limitPx);
    }
    return markPrice;
  }, [orderType, limitPx, markPrice]);

  // A marketable limit close (closing long = sell at/below mark, closing
  // short = buy at/above mark) fills immediately at ~mark, so estimates use
  // markPrice as the true exit price — mirrors the open popup's isMarketable.
  const isMarketable = useMemo(
    () =>
      orderType === 'limit' &&
      isMarketableLimit({
        direction: direction === 'Long' ? 'Short' : 'Long',
        limitPx,
        markPx: markPrice,
      }),
    [orderType, limitPx, direction, markPrice],
  );
  const estimatePx = isMarketable ? markPrice : effectivePx;

  const minClosePercent = useMemo(() => {
    const minSizeValue = PERPS_MINI_USD_VALUE / estimatePx;
    const percentValue = (minSizeValue / Number(positionSize)) * 100;

    // add one percent to avoid rounding error
    return Math.min(100, Math.round(percentValue + 1));
  }, [estimatePx, positionSize]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setClosePercent(100);
      setOrderType('market');
      setLimitPx('');
    }
  }, [visible]);

  const closedPnl = useMemo(() => {
    if (orderType === 'limit') {
      // Always price against the limit the user typed, even when it is
      // marketable: silently switching to markPrice makes the shown PnL
      // disagree with the price on screen and reads as a bug to users.
      const sign = direction === 'Long' ? 1 : -1;
      return (
        (effectivePx - entryPrice) *
        sign *
        Number(positionSize) *
        (closePercent / 100)
      );
    }
    return (pnl * closePercent) / 100;
  }, [
    orderType,
    effectivePx,
    entryPrice,
    direction,
    positionSize,
    pnl,
    closePercent,
  ]);

  // Close trades opposite the position: long -> sell (bids), short -> buy (asks)
  const {
    slippage,
    depthInsufficient,
    isReady: slippageReady,
    shouldShow: shouldShowSlippage,
  } = useMarketSlippage({
    coin,
    isBuy: direction === 'Short',
    size: Number(positionSize) * (closePercent / 100),
    markPrice,
    enabled: !!visible && orderType === 'market',
  });

  const isValidClosePercent = useMemo(() => {
    if (loading) {
      return true;
    }

    return closePercent >= minClosePercent;
  }, [closePercent, minClosePercent, loading]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const toggleOrderType = useMemoizedFn(() => {
    const next = orderType === 'market' ? 'limit' : 'market';
    setOrderType(next);
    if (next === 'market') {
      setLimitPx('');
    } else {
      setLimitPx(formatTpOrSlPrice(markPrice, szDecimals));
    }
  });

  const quantity = closeQuantitySummary(
    positionSize,
    closePercent,
    szDecimals,
    markPrice,
  );
  const disabled =
    !isValidClosePercent || (orderType === 'limit' && !(Number(limitPx) > 0));
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentHeights, setContentHeights] = useState({
    market: 355,
    limit: 399,
  });
  const [footerHeight, setFooterHeight] = useState(
    BOTTOM_BUTTON_SINGLE_HEIGHT +
      BOTTOM_BUTTON_TOP_OFFSET +
      getBottomButtonBottomOffset(insets.bottom),
  );
  const snapPoints = useMemo(
    () => [
      Math.min(
        windowHeight - insets.top,
        36 + contentHeights[orderType] + footerHeight,
      ),
    ],
    [windowHeight, insets.top, contentHeights, orderType, footerHeight],
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      handleIndicatorStyle={[
        styles.handle,
        {
          backgroundColor: isLight
            ? SIMPLE_ACCOUNT_COLORS.handle
            : colors2024['neutral-line'],
        },
      ]}
      onDismiss={onCancel}
      snapPoints={snapPoints}>
      <BottomSheetView style={styles.sheetView}>
        <AutoLockView style={styles.container}>
          <BottomSheetScrollView
            contentContainerStyle={styles.content}
            onContentSizeChange={(_width, height) =>
              setContentHeights(previous =>
                Math.abs(previous[orderType] - height) < 0.5
                  ? previous
                  : { ...previous, [orderType]: height },
              )
            }>
            <View>
              <Text style={styles.title}>
                {t('page.perpsDetail.simpleAccount.closePositionTitle', {
                  coin: displayName,
                })}
              </Text>
            </View>

            <View style={styles.amountSection}>
              <View style={styles.amountHeader}>
                <Text style={styles.amountLabel}>
                  {t('page.perpsDetail.PerpsClosePositionPopup.amount')}
                </Text>
              </View>
              <Text style={styles.percentageText}>{closePercent}%</Text>
              <Text style={styles.quantity}>
                {splitNumberByStep(quantity.notional)} {quoteAsset} ={' '}
                {quantity.quantity} {displayName}
              </Text>
              <View style={styles.slider}>
                <PerpsSlider
                  variant="close"
                  step={1}
                  value={closePercent}
                  onValueChange={setClosePercent}
                  showPercentage={false}
                />
              </View>
            </View>
            {!isValidClosePercent && (
              <Text style={styles.minimumWarning}>
                {t('page.perpsDetail.PerpsClosePositionPopup.minimumWarning', {
                  percent: minClosePercent,
                })}
              </Text>
            )}
            <View style={styles.orderTypeCard}>
              <View pointerEvents="none" style={styles.cardBorder} />
              <View style={styles.orderTypeItem}>
                <Text style={styles.pnlLabel}>
                  {t('page.perpsDetail.PerpsOpenPositionPopup.orderType')}
                </Text>
                <TouchableOpacity
                  style={styles.orderTypeToggle}
                  onPress={toggleOrderType}>
                  <Text style={styles.orderTypeToggleText}>
                    {orderType === 'market'
                      ? t(
                          'page.perpsDetail.PerpsOpenPositionPopup.orderTypeMarket',
                        )
                      : t(
                          'page.perpsDetail.PerpsOpenPositionPopup.orderTypeLimit',
                        )}
                  </Text>
                  <IconOrderTypeSwitch width={14} height={14} />
                </TouchableOpacity>
              </View>
              {orderType === 'limit' ? (
                <View style={[styles.orderTypeItem, styles.limitRow]}>
                  <Text style={styles.pnlLabel}>
                    {t('page.perpsDetail.PerpsOpenPositionPopup.limitPrice')}
                  </Text>
                  <PerpEditLimitPriceTag
                    variant="close"
                    coin={coin}
                    quoteAsset={quoteAsset}
                    markPrice={markPrice}
                    szDecimals={szDecimals}
                    // Closing trades the opposite side: long -> limit sell.
                    direction={direction === 'Long' ? 'Short' : 'Long'}
                    initLimitPrice={limitPx}
                    handleSetLimitPx={async (price: string) =>
                      setLimitPx(price)
                    }
                  />
                </View>
              ) : null}
              <View style={styles.orderTypeItem}>
                <Text style={styles.pnlLabel}>
                  {t('page.perpsDetail.simpleAccount.estimatedRealizedPnl')}
                </Text>
                <Text
                  style={[
                    styles.pnlValue,
                    closedPnl >= 0 ? styles.green : styles.red,
                  ]}>
                  {closedPnl >= 0 ? '+' : '-'}$
                  {splitNumberByStep(Math.abs(closedPnl).toFixed(2))}
                </Text>
              </View>
            </View>
            <MarketSlippage
              style={styles.slippageContainer}
              visible={
                orderType === 'market' &&
                slippageReady &&
                Number(positionSize) > 0 &&
                shouldShowSlippage
              }
              slippage={slippage}
              depthInsufficient={depthInsufficient}
            />
          </BottomSheetScrollView>
          <View
            style={styles.footer}
            onLayout={event => {
              const height = event.nativeEvent.layout.height;
              setFooterHeight(previous =>
                Math.abs(previous - height) < 0.5 ? previous : height,
              );
            }}>
            <View
              style={!disabled && !loading ? styles.confirmShadow : undefined}>
              <Button
                type="hyperliquid"
                title={t('page.perpsDetail.PerpsClosePositionPopup.confirm')}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                titleStyle={StyleSheet.flatten([
                  BOTTOM_BUTTON_TITLE_STYLE,
                  styles.confirmTitle,
                  !disabled && styles.confirmTitleActive,
                  Platform.OS === 'android'
                    ? {
                        lineHeight: undefined,
                        includeFontPadding: false,
                        textAlignVertical: 'center',
                      }
                    : { lineHeight: 22 },
                ])}
                buttonStyle={
                  !disabled && !loading ? styles.confirmButton : undefined
                }
                loading={loading}
                disabled={disabled}
                onPress={closePosition}
              />
            </View>
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => {
  const text = {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  } as const;
  return {
    sheetView: { height: '100%' },
    container: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
    handle: { width: 50.2, height: 6.3, borderRadius: 3.15 },
    footer: {
      paddingHorizontal: 20,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    title: {
      ...text,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 23,
      textAlign: 'center',
    },
    amountSection: {
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.02,
            shadowRadius: 5.5,
          }
        : {}),
    },
    amountHeader: { marginBottom: 12 },
    amountLabel: {
      ...text,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: SIMPLE_ACCOUNT_COLORS.accent,
    },
    percentageText: {
      ...text,
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '900',
      color: SIMPLE_ACCOUNT_COLORS.accent,
    },
    quantity: {
      ...text,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
      marginTop: 4,
    },
    slider: { marginTop: 16, height: 20 },
    minimumWarning: {
      ...text,
      fontWeight: '500',
      color: colors2024['red-default'],
      marginBottom: 12,
    },
    orderTypeCard: {
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    cardBorder: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 12,
    },
    orderTypeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 42,
      gap: 8,
      paddingVertical: 8,
    },
    limitRow: { minHeight: 44 },
    orderTypeToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    orderTypeToggleText: {
      ...text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-title-1'],
    },
    pnlLabel: {
      ...text,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
      flexShrink: 1,
    },
    pnlValue: {
      ...text,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      flexShrink: 1,
      textAlign: 'right',
    },
    slippageContainer: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
    },
    red: { color: colors2024['red-default'] },
    green: { color: colors2024['green-default'] },
    confirmTitle: {
      ...text,
      fontSize: 18,
      fontWeight: '700',
    },
    confirmTitleActive: { color: SIMPLE_ACCOUNT_COLORS.buttonText },
    confirmButton: {
      backgroundColor: SIMPLE_ACCOUNT_COLORS.accent,
      borderRadius: 12,
    },
    confirmShadow: {
      borderRadius: 12,
      backgroundColor: SIMPLE_ACCOUNT_COLORS.accent,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: SIMPLE_ACCOUNT_COLORS.confirmShadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
          }
        : { elevation: 4 }),
    },
  };
});
