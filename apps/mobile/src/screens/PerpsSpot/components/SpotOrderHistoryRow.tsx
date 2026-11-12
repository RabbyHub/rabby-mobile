import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Text } from '@/components/Typography';
import {
  formatSpotPrice,
  getSpotMarketDisplayName,
  type SpotMarket,
} from '@/hooks/perps/spot/spotMarkets';
import type { SpotOrderHistoryItem } from '@/hooks/perps/spot/spotOrderHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const SpotOrderHistoryRow: React.FC<{
  item: SpotOrderHistoryItem;
  onPress: (market: SpotMarket) => void;
}> = React.memo(({ item, onPress }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { market } = item;
  const isBuy = item.side === 'B';
  const price = item.avgPx
    ? formatSpotPrice(item.avgPx, market.szDecimals)
    : item.limitPx;
  // Filled: executed size. Unfilled: ordered size. Partly filled then
  // canceled: "Filled x / y".
  const isPartial = item.status !== 'filled' && item.filledSz !== '0';
  const sizeText = isPartial
    ? t('page.perpsSpot.filledOf', {
        filled: item.filledSz,
        total: `${item.origSz} ${market.baseName}`,
      })
    : `${item.status === 'filled' ? item.filledSz : item.origSz} ${
        market.baseName
      }`;

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(market)}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={[styles.side, isBuy ? styles.buy : styles.sell]}>
            {t(`page.perpsSpot.${isBuy ? 'buy' : 'sell'}`)}
          </Text>
          <Text style={styles.pair}>{getSpotMarketDisplayName(market)}</Text>
        </View>
        <Text style={styles.detail}>
          {`${sizeText} @ ${price}${
            item.avgPx ? ` ${t('page.perpsSpot.avgSuffix')}` : ''
          }`}
        </Text>
      </View>
      <View style={styles.right}>
        <Text
          style={[
            styles.status,
            item.status === 'filled'
              ? styles.statusFilled
              : item.status === 'rejected'
              ? styles.statusRejected
              : styles.statusCanceled,
          ]}>
          {t(`page.perpsSpot.status.${item.status}`)}
        </Text>
        <Text style={styles.time}>
          {dayjs(item.time).format('MM/DD HH:mm')}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
    gap: 12,
  },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  buy: { color: colors2024['green-default'] },
  sell: { color: colors2024['red-default'] },
  pair: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  detail: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  status: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  statusFilled: { color: colors2024['green-default'] },
  statusCanceled: { color: colors2024['neutral-foot'] },
  statusRejected: { color: colors2024['red-default'] },
  time: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
}));
