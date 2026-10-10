import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import type { CandleStick } from '@/components2024/TradingViewCandleChart/type';
import { usePerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
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
    coin,
    active,
    candleClose,
    decimals,
    prevDayPx,
    openInterest,
    volume,
    selection,
    style,
  }: {
    coin: string;
    active: boolean;
    candleClose: number | null;
    decimals: number;
    prevDayPx: number;
    openInterest: number;
    volume: number;
    selection: CandleStick | null;
    style: 'candle' | 'area';
  }) {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const trade = usePerpsLatestTrade({ coin, enabled: active });
    const seenTrade = useRef({ coin, seen: false });
    if (seenTrade.current.coin !== coin)
      seenTrade.current = { coin, seen: false };
    if (trade.identity === coin && trade.trade) seenTrade.current.seen = true;
    // Reuse the subscription's bounded stale cache. Candle fallback is bootstrap-only.
    const rawPrice =
      trade.identity === coin && trade.trade
        ? Number(trade.trade.price)
        : !seenTrade.current.seen
        ? candleClose
        : null;
    const candidate = selection?.close ?? rawPrice;
    const price =
      candidate !== null && Number.isFinite(candidate) && candidate > 0
        ? candidate
        : null;
    const change = simplePriceChange(
      price,
      selection ? selection.open : prevDayPx,
    );
    const [showVolume, setShowVolume] = useState(false);
    const positive = !change || change.delta >= 0;
    const color = colors2024[positive ? 'green-default' : 'red-default'];
    const ChangeIcon = positive ? Up : Down;
    const changeText = change
      ? `${change.delta >= 0 ? '+' : '-'}${simplePriceText(
          Math.abs(change.delta),
          decimals,
        )} (${change.percent >= 0 ? '+' : ''}${(change.percent * 100).toFixed(
          2,
        )}%)`
      : '—';
    return (
      <View style={styles.header}>
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
            <View style={styles.changeRow}>
              <ChangeIcon color={color} />
              <Text style={[styles.change, { color }]}>{changeText}</Text>
              <Text style={[styles.description, styles.time]}>
                {simpleSelectionTime(selection.time)}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.priceColumn}>
              <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
                {price === null ? '—' : `$${simplePriceText(price, decimals)}`}
              </Text>
              <View style={styles.changeRow}>
                <ChangeIcon color={color} />
                <Text style={[styles.change, { color }]}>{changeText}</Text>
                {!selection && <Text style={styles.description}>24h</Text>}
              </View>
            </View>
            {selection ? (
              <Text style={[styles.description, styles.areaTime]}>
                {simpleSelectionTime(selection.time)}
              </Text>
            ) : (
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
  priceColumn: { flexShrink: 1, minWidth: 0, gap: 2 },
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
    flexWrap: 'wrap',
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
  metric: { alignItems: 'flex-end', gap: 2, flexShrink: 1 },
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
  time: { marginLeft: 'auto' },
  areaTime: { textAlign: 'right', maxWidth: 110 },
}));
