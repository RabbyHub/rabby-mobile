import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import {
  formatSpotPrice,
  formatSpotSize,
  getSpotMarket24hChange,
  type SpotMarket,
} from '@/hooks/perps/spot/spotMarkets';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { createGetStyles2024 } from '@/utils/styles';

export const formatSpotPctChange = (change: number | null): string => {
  if (change === null) {
    return '-';
  }
  const pct = Math.abs(change * 100).toFixed(2);
  return `${change > 0 ? '+' : change < 0 ? '-' : ''}${pct}%`;
};

export const SpotMarketRow: React.FC<{
  market: SpotMarket;
  logo: string;
  /** Base token amount the account holds; shown as a badge when set. */
  held?: string;
  onPress: (market: SpotMarket) => void;
}> = React.memo(({ market, logo, held, onPress }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const change = getSpotMarket24hChange(market);

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(market)}>
      <AssetAvatar logo={logo} size={40} logoStyle={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.line}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{market.baseName}</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{market.quoteName}</Text>
            </View>
            {!!held && (
              <View style={styles.heldTag}>
                <Text style={styles.heldTagText}>
                  {formatSpotSize(held, market.szDecimals)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.price}>
            {market.midPx
              ? formatSpotPrice(market.midPx, market.szDecimals)
              : '-'}
          </Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.vol}>
            {t('page.perpsSpot.vol', {
              value: market.dayNtlVlm
                ? formatUsdValueKMB(market.dayNtlVlm)
                : '-',
            })}
          </Text>
          <Text
            style={[
              styles.change,
              change === null || change === 0
                ? styles.changeMuted
                : change > 0
                ? styles.changeUp
                : styles.changeDown,
            ]}>
            {formatSpotPctChange(change)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  avatar: { backgroundColor: colors2024['neutral-bg-2'] },
  content: { flex: 1, gap: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  tag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  heldTag: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  heldTagText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['brand-default'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  vol: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  change: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  changeUp: { color: colors2024['green-default'] },
  changeDown: { color: colors2024['red-default'] },
  changeMuted: { color: colors2024['neutral-secondary'] },
}));
