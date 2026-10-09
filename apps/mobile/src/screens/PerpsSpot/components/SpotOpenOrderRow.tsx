import React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { Text } from '@/components/Typography';
import {
  getSpotMarketDisplayName,
  type SpotMarket,
} from '@/hooks/perps/spot/spotMarkets';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const SpotOpenOrderRow: React.FC<{
  order: OpenOrder;
  market: SpotMarket;
  /** Show the pair name; off on a single-pair screen. */
  showPair?: boolean;
  cancelling: boolean;
  cancelDisabled: boolean;
  onCancel: (market: SpotMarket, order: OpenOrder) => void;
  onPress?: (market: SpotMarket) => void;
}> = React.memo(
  ({
    order,
    market,
    showPair,
    cancelling,
    cancelDisabled,
    onCancel,
    onPress,
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const isBuy = order.side === 'B';
    const filled = new BigNumber(order.origSz || 0).minus(order.sz || 0);

    return (
      <TouchableOpacity
        style={styles.row}
        disabled={!onPress}
        onPress={() => onPress?.(market)}>
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Text style={[styles.side, isBuy ? styles.buy : styles.sell]}>
              {t(`page.perpsSpot.${isBuy ? 'buy' : 'sell'}`)}
            </Text>
            {showPair && (
              <Text style={styles.pair}>
                {getSpotMarketDisplayName(market)}
              </Text>
            )}
          </View>
          <Text style={styles.detail}>
            {`${order.sz} ${market.baseName} @ ${order.limitPx}`}
          </Text>
          {filled.gt(0) && (
            <Text style={styles.detail}>
              {t('page.perpsSpot.filledOf', {
                filled: filled.toFixed(),
                total: order.origSz,
              })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          hitSlop={8}
          disabled={cancelDisabled}
          onPress={() => onCancel(market, order)}>
          {cancelling ? (
            <ActivityIndicator color={colors2024['neutral-foot']} />
          ) : (
            <Text style={styles.cancel}>{t('page.perpsSpot.cancel')}</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  left: { flex: 1, gap: 2 },
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
  cancel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors2024['brand-default'],
  },
}));
