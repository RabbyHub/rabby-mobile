import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { Text } from '@/components/Typography';
import {
  getSpotOrderDistanceFromMid,
  getSpotOrderFillPct,
  type SpotMarket,
} from '@/hooks/perps/spot/spotMarkets';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { formatSpotPctChange } from './SpotMarketRow';

export const SpotOpenOrderRow: React.FC<{
  order: OpenOrder;
  market: SpotMarket;
  cancelling: boolean;
  cancelDisabled: boolean;
  onCancel: (market: SpotMarket, order: OpenOrder) => void;
}> = React.memo(({ order, market, cancelling, cancelDisabled, onCancel }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isBuy = order.side === 'B';
  const fillPct = getSpotOrderFillPct(order);
  const filled = new BigNumber(order.origSz || 0).minus(order.sz || 0);
  const distance = getSpotOrderDistanceFromMid(order, market.midPx);

  return (
    <View style={styles.row}>
      <View style={[styles.sideBar, isBuy ? styles.buyBar : styles.sellBar]} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {t(isBuy ? 'page.perpsSpot.buyOrder' : 'page.perpsSpot.sellOrder', {
              size: order.origSz,
              base: market.baseName,
            })}
          </Text>
          <Text style={styles.title}>{`@ ${order.limitPx}`}</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                isBuy ? styles.buyBar : styles.sellBar,
                { width: `${fillPct}%` },
              ]}
            />
          </View>
          <Text style={styles.detail}>
            {t('page.perpsSpot.filledProgress', {
              filled: filled.gt(0) ? filled.toFixed() : '0',
              total: order.origSz,
            })}
            {distance !== null
              ? ` · ${t('page.perpsSpot.fromMid', {
                  pct: formatSpotPctChange(distance),
                })}`
              : ''}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.cancelBtn}
        hitSlop={8}
        disabled={cancelDisabled}
        onPress={() => onCancel(market, order)}>
        {cancelling ? (
          <ActivityIndicator size="small" color={colors2024['neutral-foot']} />
        ) : (
          <Text style={styles.cancel}>{t('page.perpsSpot.cancel')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  sideBar: { width: 6, height: 36, borderRadius: 3 },
  buyBar: { backgroundColor: colors2024['green-default'] },
  sellBar: { backgroundColor: colors2024['red-default'] },
  body: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors2024['neutral-line'],
    overflow: 'hidden',
  },
  fill: { height: 4 },
  detail: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  cancelBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  cancel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['red-default'],
  },
}));
