import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
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
import { MarketData } from '@/hooks/perps/usePerpsStore';

type Props = {
  visible: boolean;
  order?: OpenOrder | null;
  leverage?: Leverage | null;
  marginUsage?: number;
  marketData?: MarketData;
  onClose: () => void;
  onCancel: () => void;
};

export const PerpsLimitOrderDetailPopup: React.FC<Props> = ({
  visible,
  order,
  leverage,
  marginUsage = 0,
  marketData,
  onClose,
  onCancel,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

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
              [t('page.perps.limitOrderDetail.limitPrice'), limitPriceText],
              [t('page.perps.limitOrderDetail.marginUsage'), marginUsageText],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            type="hyperliquid"
            title={t('page.perps.limitOrderDetail.cancelLimitOrder')}
            onPress={onCancel}
            containerStyle={{ width: '100%' }}
            titleStyle={styles.btnText}
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
  buttonContainer: {
    paddingTop: 24,
    marginTop: 8,
    marginBottom: 48,
  },
  btnText: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
