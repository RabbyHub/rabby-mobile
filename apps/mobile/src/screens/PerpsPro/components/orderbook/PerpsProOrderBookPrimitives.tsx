import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';

import {
  getPerpsOrderBookDepthPercent,
  getPerpsOrderBookModeIconTones,
  type PerpsOrderBookLevel,
  type PerpsOrderBookMode,
  type PerpsOrderBookModeIconTone,
} from '../../model/orderBook';
import {
  formatPerpsProCompactNumber,
  formatPerpsProPrice,
} from '../../utils/format';

export const PERPS_PRO_ORDER_BOOK_ROW_HEIGHT = 20;
const PERPS_PRO_ORDER_BOOK_AMOUNT_DECIMALS = 2;

export const PerpsProOrderBookModeIcon: React.FC<{
  mode: PerpsOrderBookMode;
}> = ({ mode }) => {
  const { styles } = useTheme2024({ getStyle });
  const tones = getPerpsOrderBookModeIconTones(mode);
  const getToneStyle = (tone: PerpsOrderBookModeIconTone) =>
    tone === 'ask'
      ? styles.modeAsk
      : tone === 'bid'
      ? styles.modeBid
      : styles.modeNeutral;

  return (
    <View style={styles.modeIcon}>
      <View style={styles.modeGuide}>
        {tones.left.map((tone, row) => (
          <View key={row} style={[styles.modeGuideBar, getToneStyle(tone)]} />
        ))}
      </View>
      <View style={styles.modeSides}>
        {tones.right.map((tone, row) => (
          <View key={row} style={[styles.modeSideBar, getToneStyle(tone)]} />
        ))}
      </View>
    </View>
  );
};

export const PerpsProOrderBookRow: React.FC<{
  level?: PerpsOrderBookLevel;
  maxTotal: number;
  priceDecimals: number;
  side: 'ask' | 'bid';
}> = ({ level, maxTotal, priceDecimals, side }) => {
  const { styles } = useTheme2024({ getStyle });
  const depth = level ? getPerpsOrderBookDepthPercent(level, maxTotal) : 0;
  const depthStyle = useMemo<ViewStyle>(
    () => ({ width: `${depth}%` }),
    [depth],
  );

  return (
    <View style={styles.bookRow}>
      {level ? (
        <View
          pointerEvents="none"
          style={[
            styles.depth,
            side === 'bid' ? styles.bidDepth : styles.askDepth,
            depthStyle,
          ]}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.bookPrice,
          side === 'bid' ? styles.bidPrice : styles.askPrice,
        ]}>
        {level ? formatPerpsProPrice(level.priceNumber, priceDecimals) : ''}
      </Text>
      <Text numberOfLines={1} style={styles.bookAmount}>
        {level
          ? formatPerpsProCompactNumber(
              level.usdSize,
              PERPS_PRO_ORDER_BOOK_AMOUNT_DECIMALS,
            )
          : ''}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modeIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 24,
    padding: 3,
    width: 24,
  },
  modeGuide: {
    gap: 3,
    height: 18,
    width: 8,
  },
  modeGuideBar: {
    borderRadius: 1,
    flex: 1,
    minHeight: 1,
    width: 8,
  },
  modeSides: {
    gap: 2,
    height: 18,
    width: 8,
  },
  modeSideBar: {
    borderRadius: 1,
    flex: 1,
    minHeight: 1,
    width: 8,
  },
  modeNeutral: {
    backgroundColor: colors2024['neutral-info'],
  },
  modeAsk: {
    backgroundColor: colors2024['red-default'],
  },
  modeBid: {
    backgroundColor: colors2024['green-default'],
  },
  bookRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: PERPS_PRO_ORDER_BOOK_ROW_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  depth: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  askDepth: {
    backgroundColor: colors2024['red-light-1'],
  },
  bidDepth: {
    backgroundColor: colors2024['green-light-1'],
  },
  bookPrice: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    minWidth: 0,
    zIndex: 1,
  },
  askPrice: {
    color: colors2024['red-default'],
  },
  bidPrice: {
    color: colors2024['green-default'],
  },
  bookAmount: {
    color: colors2024['neutral-title-1'],
    flexShrink: 0,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'right',
    zIndex: 1,
  },
}));
