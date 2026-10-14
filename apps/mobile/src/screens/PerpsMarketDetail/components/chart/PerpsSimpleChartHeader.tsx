import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import type { SimpleChartRange } from '@/constant/perpsSimpleChart';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import type { CandleStick } from '@/components2024/TradingViewCandleChart/type';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { createGetStyles2024 } from '@/utils/styles';
import Up from '@/assets2024/icons/perps/PerpsSimpleChart/up.svg';
import Down from '@/assets2024/icons/perps/PerpsSimpleChart/down.svg';
import Metric from '@/assets2024/icons/perps/PerpsSimpleChart/metric.svg';
import {
  simplePriceChange,
  simplePriceText,
  simpleSelectionTime,
} from './model';

export const PerpsSimpleChartHeader = React.memo(
  function PerpsSimpleChartHeader({
    active,
    markPrice,
    decimals,
    prevDayPx,
    range,
    rangeReference,
    referenceLoading,
    marketLoading,
    openInterest,
    volume,
    selection,
    style,
  }: {
    active: boolean;
    markPrice: number | null;
    decimals: number;
    prevDayPx: number;
    range: SimpleChartRange | null;
    rangeReference: number | null;
    referenceLoading: boolean;
    marketLoading: boolean;
    openInterest: number;
    volume: number;
    selection: CandleStick | null;
    style: 'candle' | 'area';
  }) {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const candidate = selection?.close ?? markPrice;
    const price =
      candidate !== null && Number.isFinite(candidate) && candidate > 0
        ? candidate
        : null;
    const daily = range === null || range === '1D';
    const reference = daily ? prevDayPx : rangeReference;
    const change = simplePriceChange(
      price,
      selection ? selection.open : reference ?? NaN,
    );
    const [showVolume, setShowVolume] = useState(false);
    const positive = change !== null && change.delta >= 0;
    const color = change
      ? colors2024[positive ? 'green-default' : 'red-default']
      : colors2024['neutral-secondary'];
    const priceLoading =
      active && !selection && price === null && marketLoading;
    const changeLoading =
      active &&
      !selection &&
      change === null &&
      (priceLoading || (daily ? marketLoading : referenceLoading));
    const ChangeIcon = positive ? Up : Down;
    const changeText = change
      ? `${change.delta >= 0 ? '+' : '-'}$${simplePriceText(
          Math.abs(change.delta),
          decimals,
        )} (${change.percent >= 0 ? '+' : ''}${(change.percent * 100).toFixed(
          2,
        )}%)`
      : '—';
    return (
      <View
        style={[
          styles.header,
          selection && style === 'area' && styles.areaHeader,
        ]}>
        {selection && style === 'candle' ? (
          <View style={styles.selected}>
            <View style={styles.ohlc}>
              {(['open', 'low', 'high', 'close'] as const).map(key => (
                <View key={key} style={styles.field}>
                  <Text style={styles.description}>
                    {t(`page.perpsDetail.simpleChart.${key}`)}
                  </Text>
                  <Text style={styles.fieldValue}>
                    ${simplePriceText(selection[key], decimals)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.selectedChangeRow}>
              {change && <ChangeIcon color={color} />}
              <Text
                style={[styles.change, styles.selectedChange, { color }]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {changeText}
              </Text>
              <Text style={[styles.description, styles.time]} numberOfLines={1}>
                {simpleSelectionTime(selection.time)}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.priceColumn}>
              {priceLoading ? (
                <View style={styles.pricePlaceholder}>
                  <Skeleton
                    width={160}
                    height={28}
                    style={styles.skeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                </View>
              ) : (
                <Text
                  style={styles.price}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {price === null
                    ? '—'
                    : `$${simplePriceText(price, decimals)}`}
                </Text>
              )}
              <View
                style={[styles.changeRow, selection && styles.areaChangeRow]}>
                {changeLoading ? (
                  <Skeleton
                    width={144}
                    height={16}
                    style={styles.skeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : (
                  <>
                    {change && <ChangeIcon color={color} />}
                    <Text
                      style={[styles.change, styles.changeValue, { color }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit>
                      {changeText}
                      {!selection && (
                        <Text style={styles.description}>{` ${
                          daily ? '24h' : range
                        }`}</Text>
                      )}
                    </Text>
                  </>
                )}
                {selection && (
                  <Text
                    style={[styles.description, styles.time, styles.areaTime]}
                    numberOfLines={1}>
                    {simpleSelectionTime(selection.time)}
                  </Text>
                )}
              </View>
            </View>
            {!selection && (
              <Pressable
                style={styles.metric}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `page.perpsDetail.simpleChart.${
                    showVolume ? 'showOpenInterest' : 'showVolume'
                  }`,
                )}
                onPress={() => setShowVolume(value => !value)}>
                <View style={styles.metricValue}>
                  <Metric color={colors2024['neutral-secondary']} />
                  <Text style={styles.amount}>
                    {Number.isFinite(showVolume ? volume : openInterest)
                      ? formatUsdValueKMB(showVolume ? volume : openInterest)
                      : '—'}
                  </Text>
                </View>
                <Text style={[styles.description, styles.metricLabel]}>
                  {t(
                    `page.perpsDetail.simpleChart.${
                      showVolume ? 'volume24h' : 'openInterest'
                    }`,
                  )}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceColumn: { flex: 1, minWidth: 0, gap: 2 },
  areaHeader: { paddingRight: 12 },
  areaChangeRow: { gap: 4 },
  pricePlaceholder: { height: 36, justifyContent: 'center' },
  skeleton: {
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-2'],
    maxWidth: '100%',
  },
  changeValue: { flexShrink: 1 },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 16,
  },
  change: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  metric: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  metricValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  metricLabel: { textAlign: 'right' },
  selected: { flex: 1, gap: 4 },
  ohlc: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  field: { flexShrink: 1, gap: 2 },
  fieldValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  selectedChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  selectedChange: { flexShrink: 1 },
  time: { marginLeft: 'auto', flexShrink: 0 },
  areaTime: { textAlign: 'right', flexShrink: 0 },
}));
