import RcTooltipTail from '@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsProEvaluatedTpSlLeg,
  PerpsProTpSlMode,
} from '../../model/tpsl';
import {
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';

export const PerpsProTpSlTooltip: React.FC<{
  buy: PerpsProEvaluatedTpSlLeg | null;
  mode: PerpsProTpSlMode;
  pxDecimals: number;
  sell: PerpsProEvaluatedTpSlLeg | null;
}> = React.memo(({ buy, mode, pxDecimals, sell }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const value = (leg: PerpsProEvaluatedTpSlLeg) =>
    mode === 'price'
      ? `${formatPerpsProSignedDecimal(
          leg.estimatedPnl,
          2,
        )}(${formatPerpsProSignedDecimal(leg.estimatedRoi, 2)}%)`
      : formatPerpsProPrice(leg.triggerPrice, pxDecimals);
  const labelKeys =
    mode === 'price'
      ? (['buyProfit', 'sellProfit'] as const)
      : (['buyTrigger', 'sellTrigger'] as const);
  const singleDirection = buy == null || sell == null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        mode === 'price' ? styles.priceTooltip : styles.triggerTooltip,
        singleDirection ? styles.singleDirectionTooltip : null,
      ]}
      testID="perps-pro-tpsl-tooltip">
      <View
        style={[
          styles.body,
          singleDirection ? styles.singleDirectionBody : null,
        ]}
        testID="perps-pro-tpsl-tooltip-body">
        {buy ? (
          <Text numberOfLines={1} style={styles.line}>
            {t(`page.perps.pro.trade.${labelKeys[0]}`)}{' '}
            <Text style={styles.buyValue}>{value(buy)}</Text>
          </Text>
        ) : null}
        {sell ? (
          <Text numberOfLines={1} style={styles.line}>
            {t(`page.perps.pro.trade.${labelKeys[1]}`)}{' '}
            <Text style={styles.sellValue}>{value(sell)}</Text>
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.tail,
          mode === 'price' ? styles.priceTail : styles.triggerTail,
          singleDirection ? styles.singleDirectionTail : null,
        ]}
        testID="perps-pro-tpsl-tooltip-tail">
        <RcTooltipTail
          color={colors2024['neutral-black']}
          height={8}
          style={styles.tailIcon}
          width={12}
        />
      </View>
    </View>
  );
});

PerpsProTpSlTooltip.displayName = 'PerpsProTpSlTooltip';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tooltip: {
    left: 0,
    position: 'absolute',
    top: -27,
    zIndex: 4,
  },
  priceTooltip: { width: 206 },
  triggerTooltip: { width: 139 },
  singleDirectionTooltip: { top: -11 },
  body: {
    backgroundColor: colors2024['neutral-black'],
    borderRadius: 6,
    gap: 0,
    height: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  singleDirectionBody: { height: 24 },
  line: {
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  buyValue: { color: colors2024['red-default'] },
  sellValue: { color: colors2024['green-default'] },
  tail: {
    alignItems: 'center',
    height: 11,
    justifyContent: 'center',
    position: 'absolute',
    top: 36,
    width: 16,
  },
  priceTail: { left: 67 },
  triggerTail: { left: 33 },
  singleDirectionTail: { top: 20 },
  tailIcon: { transform: [{ rotate: '180deg' }] },
}));
