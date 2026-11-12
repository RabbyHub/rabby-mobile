import RcTooltipTail from '@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import BigNumber from 'bignumber.js';
import React from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsProEvaluatedTpSlLeg,
  PerpsProTpSlMode,
} from '../../model/tpsl';

const TOOLTIP_MAX_WIDTH = 206;
const TRIGGER_TOOLTIP_MIN_WIDTH = 139;
const TOOLTIP_BODY_HORIZONTAL_PADDING = 16;
const TOOLTIP_MEASURE_WIDTH = 10000;
const TOOLTIP_TAIL_TRANSLATE_X = -36;

type TriggerTooltipMode = Exclude<PerpsProTpSlMode, 'price'>;
export type PerpsProTpSlTooltipTone = 'negative' | 'neutral' | 'positive';

export const resolvePerpsProTpSlTooltipTone = ({
  direction,
  leg,
  mode,
}: {
  direction: 'buy' | 'sell';
  leg: PerpsProEvaluatedTpSlLeg | null;
  mode: PerpsProTpSlMode;
}): PerpsProTpSlTooltipTone => {
  if (!leg) {
    return 'neutral';
  }
  if (mode !== 'price') {
    return direction === 'buy' ? 'positive' : 'negative';
  }
  const pnl = new BigNumber(leg.estimatedPnl);
  if (!pnl.isFinite() || pnl.isZero()) {
    return 'neutral';
  }
  return pnl.gt(0) ? 'positive' : 'negative';
};

const withThousandsSeparators = (value: string) => {
  const [integer = '', fraction] = value.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return fraction == null
    ? formattedInteger
    : `${formattedInteger}.${fraction}`;
};

const formatTooltipDecimal = ({
  decimals,
  positiveOnly = false,
  signed = false,
  value,
}: {
  decimals: number;
  positiveOnly?: boolean;
  signed?: boolean;
  value: string;
}) => {
  const number = new BigNumber(value);
  if (
    !number.isFinite() ||
    (positiveOnly && !number.gt(0)) ||
    !Number.isSafeInteger(decimals) ||
    decimals < 0
  ) {
    return '-';
  }
  const sign = signed && number.gt(0) ? '+' : '';
  return `${sign}${withThousandsSeparators(number.toFixed(decimals))}`;
};

export const PerpsProTpSlTooltip: React.FC<{
  buy: PerpsProEvaluatedTpSlLeg | null;
  mode: PerpsProTpSlMode;
  pxDecimals: number;
  sell: PerpsProEvaluatedTpSlLeg | null;
}> = React.memo(({ buy, mode, pxDecimals, sell }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const value = (leg: PerpsProEvaluatedTpSlLeg | null) => {
    if (!leg) {
      return mode === 'price' ? '-- / --' : '--';
    }
    return mode === 'price'
      ? `${formatTooltipDecimal({
          decimals: 2,
          signed: true,
          value: leg.estimatedPnl,
        })}(${formatTooltipDecimal({
          decimals: 2,
          signed: true,
          value: leg.estimatedRoi,
        })}%)`
      : formatTooltipDecimal({
          decimals: pxDecimals,
          positiveOnly: true,
          value: leg.triggerPrice,
        });
  };
  const labelKeys =
    mode === 'price'
      ? (['buyProfit', 'sellProfit'] as const)
      : (['buyTrigger', 'sellTrigger'] as const);
  const buyValue = value(buy);
  const sellValue = value(sell);
  const toneStyle = (tone: PerpsProTpSlTooltipTone) =>
    tone === 'positive'
      ? styles.positiveValue
      : tone === 'negative'
      ? styles.negativeValue
      : styles.neutralValue;
  const buyValueStyle = toneStyle(
    resolvePerpsProTpSlTooltipTone({ direction: 'buy', leg: buy, mode }),
  );
  const sellValueStyle = toneStyle(
    resolvePerpsProTpSlTooltipTone({ direction: 'sell', leg: sell, mode }),
  );
  const buyLine = `${t(`page.perps.pro.trade.${labelKeys[0]}`)} ${buyValue}`;
  const sellLine = `${t(`page.perps.pro.trade.${labelKeys[1]}`)} ${sellValue}`;
  const triggerMode: TriggerTooltipMode | null = mode === 'price' ? null : mode;
  const measurementKey = JSON.stringify([mode, buyLine, sellLine]);
  const latestMeasurementKeyRef = React.useRef(measurementKey);
  React.useLayoutEffect(() => {
    latestMeasurementKeyRef.current = measurementKey;
  }, [measurementKey]);
  const [triggerLayout, setTriggerLayout] = React.useState<{
    mode: TriggerTooltipMode;
    width: number;
  }>({
    mode: triggerMode ?? 'pnl',
    width: TRIGGER_TOOLTIP_MIN_WIDTH,
  });
  const triggerWidth =
    triggerMode != null && triggerLayout.mode === triggerMode
      ? triggerLayout.width
      : TRIGGER_TOOLTIP_MIN_WIDTH;
  const handleMeasureTextLayout = React.useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (
        triggerMode == null ||
        latestMeasurementKeyRef.current !== measurementKey
      ) {
        return;
      }
      const measuredTextWidth = event.nativeEvent.lines.reduce(
        (widest, line) => Math.max(widest, line.width),
        0,
      );
      if (!Number.isFinite(measuredTextWidth) || measuredTextWidth <= 0) {
        return;
      }
      const nextWidth = Math.max(
        TRIGGER_TOOLTIP_MIN_WIDTH,
        Math.min(
          TOOLTIP_MAX_WIDTH,
          Math.ceil(measuredTextWidth + TOOLTIP_BODY_HORIZONTAL_PADDING),
        ),
      );
      setTriggerLayout(current => {
        if (
          current.mode === triggerMode &&
          (current.width === TOOLTIP_MAX_WIDTH || current.width === nextWidth)
        ) {
          // Keep the Price-aligned maximum for the rest of this focus session.
          return current;
        }
        return { mode: triggerMode, width: nextWidth };
      });
    },
    [measurementKey, triggerMode],
  );
  // The visible single-line Text reports its truncated usedRect on iOS, so it
  // cannot be the source of truth for the tooltip width.
  const shouldMeasureTrigger =
    triggerMode != null && triggerWidth < TOOLTIP_MAX_WIDTH;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        mode === 'price' ? styles.priceTooltip : styles.triggerTooltip,
        triggerMode != null ? { width: triggerWidth } : null,
      ]}
      testID="perps-pro-tpsl-tooltip">
      <View style={styles.body} testID="perps-pro-tpsl-tooltip-body">
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={styles.line}
          testID="perps-pro-tpsl-tooltip-buy-line">
          {t(`page.perps.pro.trade.${labelKeys[0]}`)}{' '}
          <Text style={buyValueStyle}>{buyValue}</Text>
        </Text>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={styles.line}
          testID="perps-pro-tpsl-tooltip-sell-line">
          {t(`page.perps.pro.trade.${labelKeys[1]}`)}{' '}
          <Text style={sellValueStyle}>{sellValue}</Text>
        </Text>
      </View>
      {shouldMeasureTrigger ? (
        <Text
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          key={measurementKey}
          onTextLayout={handleMeasureTextLayout}
          pointerEvents="none"
          style={[styles.line, styles.measureText]}
          testID="perps-pro-tpsl-tooltip-measure">
          {buyLine}
          {'\n'}
          {sellLine}
        </Text>
      ) : null}
      <View style={styles.tail} testID="perps-pro-tpsl-tooltip-tail">
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
  priceTooltip: { width: TOOLTIP_MAX_WIDTH },
  triggerTooltip: {
    maxWidth: TOOLTIP_MAX_WIDTH,
    minWidth: TRIGGER_TOOLTIP_MIN_WIDTH,
  },
  body: {
    backgroundColor: colors2024['neutral-black'],
    borderRadius: 6,
    gap: 0,
    height: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  line: {
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  positiveValue: { color: colors2024['green-default'] },
  negativeValue: { color: colors2024['red-default'] },
  neutralValue: { color: colors2024['neutral-title-2'] },
  measureText: {
    opacity: 0,
    position: 'absolute',
    width: TOOLTIP_MEASURE_WIDTH,
    zIndex: -1,
  },
  tail: {
    alignItems: 'center',
    height: 11,
    justifyContent: 'center',
    position: 'absolute',
    top: 36,
    left: '50%',
    transform: [{ translateX: TOOLTIP_TAIL_TRANSLATE_X }],
    width: 16,
  },
  tailIcon: { transform: [{ rotate: '180deg' }] },
}));
