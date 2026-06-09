import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useMemoizedFn } from 'ahooks';
import dayjs from 'dayjs';
import { Leverage, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import { AppBottomSheetModal } from '@/components';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { formatPerpsDisplayName, computeFilledPct } from '@/utils/perps';
import BigNumber from 'bignumber.js';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

const LimitPriceArrow: React.FC<{ bg: string; stroke: string }> = ({
  bg,
  stroke,
}) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Rect width={16} height={16} rx={8} fill={bg} />
    <Path
      d="M7 4.3335L11 8.00016L7 11.6668"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

type Props = {
  visible: boolean;
  order?: OpenOrder | null;
  leverage?: Leverage | null;
  marginUsage?: number;
  disableCoinNavigation?: boolean;
  onClose: () => void;
  onCancel: () => void | Promise<void>;
};

export const PerpsLimitOrderDetailPopup: React.FC<Props> = ({
  visible,
  order,
  leverage,
  marginUsage = 0,
  disableCoinNavigation,
  onClose,
  onCancel,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();
  const [cancelLoading, setCancelLoading] = useState(false);
  const coin = order?.coin;
  const marketData = perpsStore(s =>
    coin ? s.marketDataMap[coin] : undefined,
  );

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
      // Reset in case modal was dismissed while a cancel was still inflight,
      // so the next opened order doesn't show a stale spinner.
      setCancelLoading(false);
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  const handleCancel = useMemoizedFn(async () => {
    if (cancelLoading) {
      return;
    }
    setCancelLoading(true);
    try {
      await onCancel();
    } finally {
      setCancelLoading(false);
    }
  });

  const handleGoToMarketDetail = useMemoizedFn(() => {
    if (!order) {
      return;
    }
    onClose();
    // Detail-page caller has its rows pre-filtered to the current coin, so
    // navigating here would only push a duplicate of the current screen.
    if (disableCoinNavigation) {
      return;
    }
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: {
        market: order.coin,
      },
    });
  });

  if (!order) {
    return null;
  }

  const isBuy = order.side === 'B';
  const sideText = isBuy
    ? t('page.perps.limitOrderDetail.buy')
    : t('page.perps.limitOrderDetail.sell');
  const name = marketData?.displayName || order.coin;
  const pair = formatPerpsDisplayName(name, marketData?.quoteAsset || 'USDC');
  const title = t('page.perps.limitOrderDetail.title', {
    side: sideText,
    pair,
  });
  const filledPct = computeFilledPct(order.origSz, order.sz);
  const time = dayjs(order.timestamp).format('YYYY-MM-DD HH:mm');
  const quoteAsset = marketData?.quoteAsset || 'USDC';
  const notional = new BigNumber(order.limitPx || 0).times(order.sz || 0);
  const sizeText = `${splitNumberByStep(
    notional.toFixed(2),
  )} ${quoteAsset} = ${splitNumberByStep(order.sz)} ${name}`;
  const limitPriceText = `@ $${splitNumberByStep(order.limitPx)}`;
  const currentPriceText = marketData?.markPx
    ? `$${splitNumberByStep(marketData.markPx)}`
    : '-';
  const marginUsageText = leverage ? formatUsdValue(marginUsage) : '-';

  return (
    <AppBottomSheetModal
      // snapPoints={[440]}
      enableDynamicSizing
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: isLight ? 'bg0' : 'bg1',
        colors: colors2024,
      })}>
      <BottomSheetView style={styles.container}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.rows}>
          {(
            [
              [t('page.perps.limitOrderDetail.time'), time],
              [t('page.perps.limitOrderDetail.size'), sizeText],
              [
                t('page.perps.limitOrderDetail.filled'),
                `${filledPct.toFixed(0)}%`,
              ],
              [
                t('page.perps.limitOrderDetail.currentPrice'),
                currentPriceText,
                'currentPrice',
              ],
              [t('page.perps.limitOrderDetail.limitPrice'), limitPriceText],
              [t('page.perps.limitOrderDetail.marginUsage'), marginUsageText],
            ] as Array<[string, string, string?]>
          ).map(([label, value, key]) =>
            key === 'currentPrice' ? (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <TouchableOpacity
                  style={styles.limitPriceValue}
                  onPress={handleGoToMarketDetail}
                  activeOpacity={0.6}>
                  <Text style={styles.rowValue}>{value}</Text>
                  <LimitPriceArrow
                    bg={
                      isLight
                        ? colors2024['neutral-bg-2']
                        : colors2024['neutral-bg-4']
                    }
                    stroke={colors2024['neutral-foot']}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ),
          )}
        </View>

        <View
          style={[
            styles.buttonContainer,
            { marginBottom: getBottomButtonBottomOffset(bottom) },
          ]}>
          <Button
            type="hyperliquid"
            title={t('page.perps.limitOrderDetail.cancelLimitOrder')}
            onPress={handleCancel}
            loading={cancelLoading}
            containerStyle={{ width: '100%' }}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          />
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 20,
    flex: 1,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 16,
  },
  rows: {
    paddingVertical: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  limitPriceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  buttonContainer: {
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    marginTop: 8,
    marginBottom: 36,
  },
}));
