import { usePerpsProTwapClock } from '../../scene/usePerpsProTwapClock';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import type { PerpsTwapRecord } from '@/hooks/perps/twap/types';
import { getPerpsTwapSummary } from '@/hooks/perps/twap/twapReconciliation';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import { buildPerpsProMarketDescriptor } from '../../model/market';
import { formatPerpsProDecimal } from '../../utils/format';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProSolidSideTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { resolvePerpsProFittedFontSize } from '../common/perpsProFitFontSize';
import { PerpsProTextWidthProbe } from '../common/PerpsProTextWidthProbe';

export const usePerpsProTwapMarket = (coin: string, needsPrice: boolean) =>
  perpsStore(
    useShallow(state => {
      const market = state.marketDataMap[coin];
      if (!market) return null;
      const descriptor = buildPerpsProMarketDescriptor(market);
      return {
        displayBase: descriptor.displayBase,
        displayPair: descriptor.displayPair,
        quoteAsset: descriptor.quoteAsset,
        sourceTag: descriptor.sourceTag,
        szDecimals: market.szDecimals,
        pxDecimals: market.pxDecimals,
        midPrice: needsPrice ? market.midPx : undefined,
      };
    }),
  );

export const formatTwapDuration = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return hours
    ? `${hours}h${minutes ? ` ${minutes}m` : ''}`
    : minutes
    ? `${minutes}m${whole % 60 ? ` ${whole % 60}s` : ''}`
    : `${whole}s`;
};

export const PerpsProTwapValue = React.memo(
  ({
    value,
    label,
    fullWidth = false,
    right = false,
  }: {
    value: string;
    label: string;
    fullWidth?: boolean;
    right?: boolean;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const [availableWidth, setAvailableWidth] = useState(0);
    const [measured, setMeasured] = useState({ text: '', width: 0 });
    const fontSize = resolvePerpsProFittedFontSize({
      availableWidth,
      baseFontSize: 14,
      minFontSize: 10,
      naturalWidth: measured.text === value ? measured.width : 0,
    });
    return (
      <View style={[styles.cell, fullWidth && { width: '100%' }]}>
        <Text
          numberOfLines={1}
          style={[styles.cellLabel, right && styles.rightText]}>
          {label}
        </Text>
        <View
          onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}>
          <PerpsProTextWidthProbe
            text={value}
            style={styles.cellValue}
            onWidth={width =>
              setMeasured(current =>
                current.text === value && current.width === width
                  ? current
                  : { text: value, width },
              )
            }
          />
          <Text
            numberOfLines={1}
            style={[styles.cellValue, { fontSize }, right && styles.rightText]}>
            {value}
          </Text>
        </View>
      </View>
    );
  },
);
PerpsProTwapValue.displayName = 'PerpsProTwapValue';

export const PerpsProTwapCard = React.memo(
  ({
    order,
    amountUnit,
    now,
    onEnd,
    onDetail,
    detail = false,
    active = true,
    history = false,
  }: {
    order: PerpsTwapRecord;
    amountUnit: PerpsProTradeAmountUnit;
    now: number;
    onEnd?: (order: PerpsTwapRecord) => void;
    onDetail?: (order: PerpsTwapRecord) => void;
    detail?: boolean;
    active?: boolean;
    history?: boolean;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const market = usePerpsProTwapMarket(
      order.state.coin,
      amountUnit === 'quote' && order.endedAt === null,
    );
    const summary = useMemo(
      () => getPerpsTwapSummary(order, market?.midPrice),
      [order, market?.midPrice],
    );
    const base = amountUnit === 'base';
    const unit = base
      ? market?.displayBase ?? order.state.coin
      : market?.quoteAsset ?? '--';
    const size = base ? order.state.sz : summary.totalQuote;
    const filled = base ? order.state.executedSz : summary.filledQuote;
    const decimals = base ? market?.szDecimals ?? 8 : 2;
    const tone =
      summary.status === 'filled' || summary.status === 'working'
        ? colors2024['green-default']
        : summary.status === 'expired'
        ? colors2024['red-default']
        : colors2024['neutral-secondary'];
    const statusBackground =
      summary.status === 'filled' || summary.status === 'working'
        ? colors2024['green-light-1']
        : summary.status === 'expired'
        ? colors2024['red-light-1']
        : colors2024['neutral-bg-5'];
    const sideBackground =
      colors2024[order.state.side === 'B' ? 'green-light-1' : 'red-light-1'];
    const sideColor =
      colors2024[order.state.side === 'B' ? 'green-default' : 'red-default'];
    const elapsed =
      summary.actualSeconds ??
      Math.max(0, Math.floor((now - order.state.timestamp) / 1000));
    const rows = [
      [
        t('page.perps.pro.twap.totalSize') + ` (${unit})`,
        size === null
          ? '--'
          : `${base ? '' : '≈'}${formatPerpsProDecimal(size, decimals)}`,
      ],
      [
        t('page.perps.pro.twap.filled') + ` (${unit})`,
        formatPerpsProDecimal(filled, decimals),
      ],
      [
        t(
          !history && order.endedAt === null
            ? 'page.perps.pro.twap.duration'
            : 'page.perps.pro.twap.runtime',
        ),
        history && summary.actualSeconds === null
          ? '--'
          : formatTwapDuration(elapsed),
      ],
      [
        t('page.perps.pro.twap.totalTime'),
        formatTwapDuration(summary.plannedSeconds),
      ],
      [
        t('page.perps.pro.twap.averageFilledPrice'),
        summary.averagePrice === null
          ? '--'
          : formatPerpsProDecimal(
              summary.averagePrice,
              market?.pxDecimals ?? 6,
            ),
      ],
      [
        t('page.perps.pro.trade.reduceOnly'),
        t(
          order.state.reduceOnly
            ? 'page.perps.pro.trade.yes'
            : 'page.perps.pro.trade.no',
        ),
      ],
    ];
    return (
      <View style={styles.card}>
        <Pressable
          disabled={!onDetail || detail}
          onPress={() => onDetail?.(order)}
          accessibilityRole={onDetail && !detail ? 'button' : undefined}>
          <View style={styles.heading}>
            <View style={styles.symbols}>
              <Text style={[styles.side, { backgroundColor: sideColor }]}>
                {order.state.side === 'B' ? 'B' : 'S'}
              </Text>
              <Text numberOfLines={1} style={styles.symbol}>
                {market?.displayPair ?? order.state.coin}
              </Text>
              {market?.sourceTag ? (
                <Text style={styles.source}>{market.sourceTag}</Text>
              ) : null}
            </View>
            <View style={styles.status}>
              <View style={styles.progressGroup}>
                <Text style={styles.progressText}>
                  {formatPerpsProDecimal(String(summary.percentage), 1)}%
                </Text>
                <View style={styles.progress}>
                  <View
                    style={[
                      styles.progressFilled,
                      {
                        backgroundColor: sideColor,
                        width: `${summary.percentage}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              {detail || !order.active || summary.status === 'waiting' ? (
                <Text
                  style={[
                    styles.statusTag,
                    { color: tone, backgroundColor: statusBackground },
                  ]}>
                  {t(`page.perps.pro.twap.status.${summary.status}`)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.tags}>
            <Text
              style={[
                styles.tag,
                order.active && {
                  color: sideColor,
                  backgroundColor: sideBackground,
                },
              ]}>
              TWAP
            </Text>
            {order.state.randomize ? (
              <Text style={styles.tag}>
                {t('page.perps.pro.twap.randomized')}
              </Text>
            ) : null}
            <Text style={styles.time}>
              {dayjs(order.endedAt ?? order.state.timestamp).format(
                'YYYY/MM/DD HH:mm:ss',
              )}
              {order.endedAt !== null
                ? ` ${t('page.perps.pro.twap.endedLabel')}`
                : ''}
            </Text>
          </View>
          <View style={styles.grid}>
            {rows.map(([label, value], index) =>
              index === 2 && order.active ? (
                <PerpsProTwapElapsed
                  key={label}
                  active={active}
                  start={order.state.timestamp}
                  label={label}
                />
              ) : (
                <PerpsProTwapValue
                  key={label}
                  label={label}
                  value={value}
                  right={index % 2 === 1}
                />
              ),
            )}
          </View>
          {detail && order.description ? (
            <Text style={styles.reason}>{order.description}</Text>
          ) : null}
        </Pressable>
        {order.active && !detail ? (
          <View style={styles.actions}>
            <Pressable
              disabled={!onEnd}
              style={styles.action}
              onPress={() => onEnd?.(order)}>
              <Text style={styles.actionText}>
                {t('page.perps.pro.twap.end')}
              </Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => onDetail?.(order)}>
              <Text style={styles.actionText}>
                {t('page.perps.pro.twap.detail')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  },
);
PerpsProTwapCard.displayName = 'PerpsProTwapCard';
const PerpsProTwapElapsed = ({
  active,
  start,
  label,
}: {
  active: boolean;
  start: number;
  label: string;
}) => {
  const now = usePerpsProTwapClock(active);
  return (
    <PerpsProTwapValue
      label={label}
      value={formatTwapDuration((now - start) / 1000)}
    />
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 12,
    backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  symbols: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
  source: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    ...getPerpsProMetadataTagTextStyle(colors2024),
    overflow: 'hidden',
  },
  side: {
    height: 16,
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
    ...getPerpsProSolidSideTagTextStyle(colors2024),
    textAlign: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusTag: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressGroup: { alignItems: 'center', gap: 4 },
  rightText: { textAlign: 'right' },
  tags: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  tag: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    ...getPerpsProMetadataTagTextStyle(colors2024),
    color: colors2024['neutral-secondary'],
    overflow: 'hidden',
  },
  progressText: {
    ...PERPS_PRO_NUMBER_STYLE,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  progress: {
    height: 2,
    width: 32,
    backgroundColor: colors2024['neutral-line'],
    overflow: 'hidden',
  },
  progressFilled: { height: 2 },
  time: {
    ...PERPS_PRO_NUMBER_STYLE,
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginTop: 12 },
  cell: { width: '50%', gap: 6, minWidth: 0 },
  cellLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  cellValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  actionText: {
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  reason: {
    fontSize: 13,
    lineHeight: 18,
    color: colors2024['red-default'],
    marginTop: 12,
  },
}));
