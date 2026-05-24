import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { OpenOrder, Leverage } from '@rabby-wallet/hyperliquid-sdk';

import { Text } from '@/components/Typography';
import { AssetAvatar } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { computeFilledPct } from '@/utils/perps';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsDisplayCoinName } from '../PerpsDisplayCoinName';

// Circle progress ring. percent in [0, 100], filled clockwise from 12 o'clock.
const FilledProgressIcon: React.FC<{
  percent: number;
  size?: number;
  bgColor: string;
  fillColor: string;
}> = ({ percent, size = 14, bgColor, fillColor }) => {
  const cx = 7;
  const cy = 7;
  const r = 6;
  const p = Math.min(Math.max(percent, 0), 100);
  let arcD = '';
  if (p > 0 && p < 100) {
    const angle = (p / 100) * 2 * Math.PI - Math.PI / 2;
    const endX = cx + r * Math.cos(angle);
    const endY = cy + r * Math.sin(angle);
    const largeArc = p > 50 ? 1 : 0;
    arcD = `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
  } else if (p >= 100) {
    arcD = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${
      cy + r
    } A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={bgColor}
        strokeWidth={2}
        fill="none"
      />
      {arcD ? (
        <Path
          d={arcD}
          stroke={fillColor}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
};

export type Props = {
  order: OpenOrder;
  leverage: Leverage | null;
  marginUsage: number;
  onPress: () => void;
};

export const PerpsLimitOrderItem: React.FC<Props> = ({
  order,
  leverage,
  marginUsage,
  onPress,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const marketData = perpsStore(s => s.marketDataMap[order.coin]);

  // Hyperliquid: side === 'B' means Bid → Buy → Long visual.
  const isBuy = order.side === 'B';
  const sideText = isBuy
    ? t('page.perps.limitOrderDetail.buy')
    : t('page.perps.limitOrderDetail.sell');
  const directionText = isBuy ? 'Long' : 'Short';
  const filledPct = computeFilledPct(order.origSz, order.sz);
  const leverageType = leverage?.type ?? 'isolated';
  const leverageText = leverage ? `${leverage.value}x` : '';
  const logoUrl = marketData?.logoUrl || '';
  const limitPriceText = `@ $${splitNumberByStep(order.limitPx)}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.mainContent}>
        <View style={styles.leftSection}>
          <View style={styles.coinInfoRow}>
            <AssetAvatar logo={logoUrl} size={28} logoStyle={styles.icon} />
            <View style={styles.coinNameRow}>
              <Text style={styles.sideText}>{sideText}</Text>
              <PerpsDisplayCoinName item={marketData} coin={order.coin} />
            </View>
          </View>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.directionTag,
                {
                  backgroundColor: isBuy
                    ? colors2024['green-light-1']
                    : colors2024['red-light-1'],
                },
              ]}>
              <Text
                style={[
                  styles.directionText,
                  isBuy ? styles.longText : styles.shortText,
                ]}>
                {directionText}
                {leverageText ? ` ${leverageText}` : ''}
              </Text>
            </View>
            <View style={styles.crossTag}>
              <Text style={styles.crossText}>
                {leverageType === 'cross'
                  ? t('page.perpsDetail.PerpsPosition.cross')
                  : t('page.perpsDetail.PerpsPosition.isolated')}
              </Text>
            </View>
            <Text style={styles.limitPriceText}>{limitPriceText}</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <Text style={styles.marginText}>
            {leverage ? formatUsdValue(marginUsage) : '-'}
          </Text>
          <View style={styles.filledRow}>
            <FilledProgressIcon
              percent={filledPct}
              bgColor={colors2024['neutral-info']}
              fillColor="#23C0B0"
            />
            <Text style={styles.filledText}>
              {t('page.perps.limitOrderDetail.filled')} {filledPct.toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 14,
  },
  mainContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: { flexDirection: 'column', gap: 4, flex: 1 },
  coinInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 28,
    height: 28,
    backgroundColor: 'white',
    flexShrink: 0,
    borderRadius: 1000,
  },
  coinNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  crossTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  crossText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directionTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
  },
  directionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  longText: { color: colors2024['green-default'] },
  shortText: { color: colors2024['red-default'] },
  limitPriceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  rightSection: { alignItems: 'flex-end', gap: 4 },
  marginText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  filledRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filledText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
