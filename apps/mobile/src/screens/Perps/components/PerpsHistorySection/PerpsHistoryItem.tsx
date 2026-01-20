import { RcIconLong, RcIconShort } from '@/assets2024/icons/perps';
import { AssetAvatar } from '@/components';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';

export const PerpsHistoryItem: React.FC<{
  fill: WsFill;
  marketData: Record<string, MarketData>;
  onPress?: (fill: WsFill) => void;
  orderTpOrSl?: 'tp' | 'sl';
}> = ({ fill, orderTpOrSl, marketData, onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { coin, closedPnl: _closedPnl, dir, fee, px } = fill as WsFill;

  const titleString = useMemo(() => {
    const isLiquidation = Boolean(fill?.liquidation);
    if (fill?.dir === 'Close Long') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.history.closeLongTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.history.closeLongSl');
      }

      return isLiquidation
        ? t('page.perps.history.closeLongLiquidation')
        : t('page.perps.history.closeLong');
    }
    if (fill?.dir === 'Close Short') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.history.closeShortTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.history.closeShortSl');
      }

      return isLiquidation
        ? t('page.perps.history.closeShortLiquidation')
        : t('page.perps.history.closeShort');
    }
    if (fill?.dir === 'Open Long') {
      return t('page.perps.history.openLong');
    }
    if (fill?.dir === 'Open Short') {
      return t('page.perps.history.openShort');
    }
    return fill?.dir;
  }, [fill?.dir, fill?.liquidation, orderTpOrSl, t]);

  const itemData = marketData[coin.toUpperCase()];
  const logoUrl = itemData?.logoUrl;
  const isClose = (dir === 'Close Long' || dir === 'Close Short') && _closedPnl;
  const direction =
    dir === 'Close Long' || dir === 'Open Long' ? 'Long' : 'Short';
  const closedPnl = Number(_closedPnl) - Number(fee);
  const pnlValue = closedPnl ? closedPnl : 0;

  return (
    <TouchableOpacity onPress={() => onPress?.(fill)}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <AssetAvatar logo={logoUrl} logoStyle={styles.icon} size={46} />
          {direction === 'Long' ? (
            <RcIconLong
              style={styles.directionIcon}
              bgColor={colors2024['neutral-bg-1']}
              color={colors2024['neutral-title-1']}
            />
          ) : (
            <RcIconShort
              style={styles.directionIcon}
              bgColor={colors2024['neutral-bg-1']}
              color={colors2024['neutral-title-1']}
            />
          )}
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.name}>{titleString}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.coin}>
              {coin}-USD @${Number(px)}
            </Text>
          </View>
        </View>
        <View style={styles.extra}>
          {isClose ? (
            <Text style={[styles.pnl, pnlValue < 0 ? styles.pnlRed : null]}>
              {pnlValue > 0 ? '+' : '-'}$
              {splitNumberByStep(Math.abs(pnlValue).toFixed(2))}
            </Text>
          ) : null}
          <Text style={styles.time}>{sinceTime(fill.time / 1000)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  directionIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 1000,
  },
  content: {
    flex: 1,

    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
  },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  extra: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pnl: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
  },
  pnlRed: {
    color: colors2024['red-default'],
  },
  coin: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    whiteSpace: 'nowrap',
  },
  time: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
