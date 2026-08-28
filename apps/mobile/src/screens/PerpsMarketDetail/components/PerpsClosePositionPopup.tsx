import AutoLockView from '@/components/AutoLockView';
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent } from '@/screens/Home/utils/price';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { PerpsSlider } from './PerpsSlider';
import { MarketSlippage } from './MarketSlippage';
import { useMarketSlippage } from '../hooks/useMarketSlippage';
import { PerpEditLimitPriceTag } from './PerpEditLimitPriceTag';
import IconOrderTypeSwitch from '@/assets2024/icons/perps/IconOrderTypeSwitch.svg';
import { formatTpOrSlPrice, isMarketableLimit } from '@/utils/perps';
import {
  PERPS_EXCHANGE_FEE_NUMBER,
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
  direction,
  positionSize,
  marginUsed,
  pnl,
  markPrice,
  entryPrice,
  szDecimals,
  quoteAsset = 'USDC',
  providerFee,
  onCancel,
  onConfirm,
  handleClosePosition,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

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

  const bothFee = useMemo(() => {
    return providerFee + PERPS_EXCHANGE_FEE_NUMBER;
  }, [providerFee]);

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

  const snapPoints = useMemo(
    () => [orderType === 'limit' ? 622 : 578],
    [orderType],
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onCancel}
      snapPoints={snapPoints}>
      <BottomSheetView style={styles.sheetView}>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perpsDetail.PerpsClosePositionPopup.title')}
            </Text>
          </View>

          <View style={styles.amountSection}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.amount')}
              </Text>
            </View>
            <View style={styles.amountValueRow}>
              <View style={styles.amountValueContainer}>
                <Text style={styles.amountValue}>
                  ${splitNumberByStep(marginUsed.toFixed(2))}
                </Text>
                <Text style={styles.totalLabel}>
                  {t('page.perpsDetail.PerpsClosePositionPopup.total')}
                </Text>
              </View>
              <Text style={styles.percentageText}>{closePercent}%</Text>
            </View>
            <View style={styles.minimumWarningContainer}>
              {!isValidClosePercent && (
                <Text style={styles.minimumWarning}>
                  {t(
                    'page.perpsDetail.PerpsClosePositionPopup.minimumWarning',
                    {
                      percent: minClosePercent,
                    },
                  )}
                </Text>
              )}
            </View>
            <PerpsSlider
              step={1}
              value={closePercent}
              onValueChange={setClosePercent}
              showPercentage={false}
            />
          </View>

          <View style={styles.orderTypeCard}>
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
              <View style={styles.orderTypeItem}>
                <Text style={styles.pnlLabel}>
                  {t('page.perpsDetail.PerpsOpenPositionPopup.limitPrice')}
                </Text>
                <PerpEditLimitPriceTag
                  coin={coin}
                  quoteAsset={quoteAsset}
                  markPrice={markPrice}
                  szDecimals={szDecimals}
                  // Closing trades the opposite side: long -> limit sell.
                  direction={direction === 'Long' ? 'Short' : 'Long'}
                  initLimitPrice={limitPx}
                  handleSetLimitPx={async (price: string) => setLimitPx(price)}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.pnlCard}>
            <View style={styles.pnlCardRow}>
              <Text style={styles.pnlLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.estReceive')}
              </Text>
              <Text style={[styles.pnlValue]}>
                {'+'}$
                {splitNumberByStep(
                  ((marginUsed * closePercent) / 100).toFixed(2),
                )}
              </Text>
            </View>
            <View style={styles.pnlCardRow}>
              <Text style={styles.pnlLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.estClosedPnl')}
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

          <View style={styles.footer}>
            <Button
              type="hyperliquid"
              title={t('page.perpsDetail.PerpsClosePositionPopup.confirm')}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              loading={loading}
              disabled={
                !isValidClosePercent ||
                (orderType === 'limit' && !(Number(limitPx) > 0))
              }
              onPress={closePosition}
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(ctx => {
  const { colors2024, isLight, safeAreaInsets } = ctx;
  return {
    sheetView: {
      height: '100%',
    },
    container: {
      height: '100%',
      paddingHorizontal: 20,
    },
    footer: {
      marginTop: 'auto',
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 20,
      textAlign: 'center',
    },
    amountSection: {
      backgroundColor: colors2024['neutral-bg-2'],
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 20,
      paddingVertical: 16,
      paddingBottom: 20,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    amountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    amountLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: '#50D2C1',
    },
    percentageText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '900',
      color: '#50D2C1',
    },
    amountValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    amountValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
    },
    amountValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
    },
    totalLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-info'],
    },
    minimumWarning: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    minimumWarningContainer: {
      marginBottom: 16,
      // marginTop: -4,
      height: 14,
    },
    pnlCardRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    orderTypeCard: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      width: '100%',
      marginBottom: 12,
    },
    orderTypeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    orderTypeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    orderTypeToggleText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    pnlCard: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      alignContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    slippageContainer: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    pnlLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    pnlValue: {
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
    },
    red: {
      color: colors2024['red-default'],
    },
    green: {
      color: colors2024['green-default'],
    },
    feeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 20,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
