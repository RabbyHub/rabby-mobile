import { RcIconLong } from '@/assets2024/icons/perps';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import FastImage from 'react-native-fast-image';

// todo
export const PerpsHistoryItem: React.FC<{
  fill: WsFill;
  marketData: Record<string, MarketData>;
  onPress?: (fill: WsFill) => void;
  orderTpOrSl?: 'tp' | 'sl';
}> = ({ fill, orderTpOrSl, marketData }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { coin, closedPnl: _closedPnl, dir, fee } = fill as WsFill;

  const titleString = useMemo(() => {
    const isLiquidation = Boolean(fill?.liquidation);
    if (fill?.dir === 'Close Long') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.historyDetail.title.closeLongTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.historyDetail.title.closeLongSl');
      }

      return isLiquidation
        ? t('page.perps.historyDetail.title.closeLongLiquidation')
        : t('page.perps.historyDetail.title.closeLong');
    }
    if (fill?.dir === 'Close Short') {
      if (orderTpOrSl === 'tp') {
        return t('page.perps.historyDetail.title.closeShortTp');
      }
      if (orderTpOrSl === 'sl') {
        return t('page.perps.historyDetail.title.closeShortSl');
      }

      return isLiquidation
        ? t('page.perps.historyDetail.title.closeShortLiquidation')
        : t('page.perps.historyDetail.title.closeShort');
    }
    if (fill?.dir === 'Open Long') {
      return t('page.perps.historyDetail.title.openLong');
    }
    if (fill?.dir === 'Open Short') {
      return t('page.perps.historyDetail.title.openShort');
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
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <FastImage source={{ uri: logoUrl }} style={styles.icon} />
        <RcIconLong
          style={styles.directionIcon}
          bgColor={colors2024['neutral-bg-1']}
          color={colors2024['neutral-title-1']}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.name}>{titleString}</Text>
          <Text style={styles.price}>$114,539.00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.leverage}>Short 10x</Text>
          <Text style={[styles.priceChange, styles.priceChangeDown]}>
            +$24.32 (+0.87%)
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors2024['neutral-bg-1'],
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
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  leverage: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  priceChange: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['green-default'],
  },
  priceChangeDown: {
    color: colors2024['red-default'],
  },
}));
