import { AssetAvatar } from '@/components';
import { MarketData, PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { DistanceToLiquidationTag } from './DistanceToLiquidationTag';
import { useMemoizedFn } from 'ahooks';
import { calculateDistanceToLiquidation } from './utils';
import { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { useTranslation } from 'react-i18next';

export const PerpsPositionItem: React.FC<{
  item: PositionAndOpenOrder['position'];
  marketData?: MarketData;
  onPress(): void;
  openOrders: OpenOrder[];
  onShowRiskPopup: (coin: string) => void;
}> = ({ item, marketData, onPress, openOrders, onShowRiskPopup }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const {
    coin,
    leverage,
    marginUsed,
    unrealizedPnl,
    returnOnEquity,
    liquidationPx,
    entryPx,
  } = item;
  const isUp = Number(unrealizedPnl) >= 0;

  const sign = isUp ? '+' : '-';
  const side =
    Number(liquidationPx || 0) < Number(entryPx || 0) ? 'Long' : 'Short';
  const absPnlUsd = Math.abs(Number(unrealizedPnl));
  const absPnlPct = Math.abs(Number(returnOnEquity));
  const leverageType = item.leverage.type || 'isolated';
  const pnlText = `${sign}${formatUsdValue(absPnlUsd)}`;
  const logoUrl = marketData?.logoUrl || '';
  const leverageText = `${leverage.value}x`;

  const { tpPrice, slPrice } = useMemo(() => {
    if (!openOrders || !openOrders.length) {
      return {
        tpPrice: undefined,
        slPrice: undefined,
      };
    }

    const tpItem = openOrders.find(
      order =>
        order.orderType === 'Take Profit Market' &&
        order.isTrigger &&
        order.reduceOnly,
    );

    const slItem = openOrders.find(
      order =>
        order.orderType === 'Stop Market' &&
        order.isTrigger &&
        order.reduceOnly,
    );

    return {
      tpPrice: Number(tpItem?.triggerPx || 0),
      slPrice: Number(slItem?.triggerPx || 0),
    };
  }, [openOrders]);

  // Check if there's take profit or stop loss
  const hasTakeProfit = !!tpPrice;
  const hasStopLoss = !!slPrice;

  const handleDistanceTagPress = useMemoizedFn(() => {
    onShowRiskPopup(coin);
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.mainContent}>
        {/* Left section: icon + coin info */}
        <View style={styles.leftSection}>
          <View style={styles.coinInfoRow}>
            <AssetAvatar logo={logoUrl} size={28} />
            <View style={styles.coinInfo}>
              <View style={styles.coinNameRow}>
                <Text style={styles.coinName}>{coin}</Text>
                <View style={styles.crossTag}>
                  <Text style={styles.crossText}>
                    {leverageType === 'cross'
                      ? t('page.perpsDetail.PerpsPosition.cross')
                      : t('page.perpsDetail.PerpsPosition.isolated')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.leverageTag,
                {
                  backgroundColor:
                    side === 'Long'
                      ? colors2024['green-light-1']
                      : colors2024['red-light-1'],
                },
              ]}>
              <Text
                style={[
                  styles.leverageText,
                  side === 'Long' ? styles.longText : styles.shortText,
                ]}>
                {side} {leverageText}
              </Text>
            </View>
            {!hasStopLoss && (
              <DistanceToLiquidationTag
                liquidationPrice={liquidationPx}
                markPrice={marketData?.markPx}
                onPress={handleDistanceTagPress}
              />
            )}
          </View>
        </View>

        {/* Right section: price + PnL */}
        <View style={styles.rightSection}>
          <Text style={styles.priceText}>
            {formatUsdValue(Number(marginUsed))}
          </Text>
          <Text
            style={[
              styles.pnlText,
              isUp ? styles.pnlTextUp : styles.pnlTextDown,
            ]}>
            {pnlText}
          </Text>
        </View>
      </View>

      {(hasTakeProfit || hasStopLoss) && (
        <View style={styles.tpSlSection}>
          {hasTakeProfit && (
            <Text style={styles.tpSlText}>
              {t('page.perps.PerpsAutoCloseModal.takeProfit')} :{' '}
              <Text style={styles.tpSlPrice}>
                ${splitNumberByStep(tpPrice)}
              </Text>
            </Text>
          )}
          {hasTakeProfit && hasStopLoss && (
            <Text style={styles.tpSlSeparator}> | </Text>
          )}
          {hasStopLoss && (
            <Text style={styles.tpSlText}>
              {t('page.perps.PerpsAutoCloseModal.stopLoss')} :{' '}
              <Text style={styles.tpSlPrice}>
                ${splitNumberByStep(slPrice)}
              </Text>
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    // paddingHorizontal: 14,
    paddingVertical: 14,
  },
  mainContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  coinInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinInfo: {
    flex: 1,
    gap: 6,
  },
  coinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  crossText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  crossTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leverageTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
  },
  leverageText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  longText: {
    color: colors2024['green-default'],
  },
  shortText: {
    color: colors2024['red-default'],
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.8,
  },
  distanceDotContainer: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  pnlPctText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  pnlPctUp: {
    color: colors2024['green-default'],
  },
  pnlPctDown: {
    color: colors2024['red-default'],
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  pnlText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  pnlTextUp: {
    color: colors2024['green-default'],
  },
  pnlTextDown: {
    color: colors2024['red-default'],
  },
  tpSlSection: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    paddingHorizontal: 14,
    borderTopColor: colors2024['neutral-line'],
  },
  tpSlText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  tpSlPrice: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  tpSlSeparator: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 4,
    color: colors2024['neutral-foot'],
  },
}));
