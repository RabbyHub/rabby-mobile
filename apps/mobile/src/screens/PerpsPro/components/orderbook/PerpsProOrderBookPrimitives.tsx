import { Text } from '@/components/Typography';
import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import {
  getPerpsOrderBookDepthPercent,
  getPerpsOrderBookModeIconState,
  type PerpsOrderBookLevel,
  type PerpsOrderBookMode,
} from '../../model/orderBook';
import {
  formatPerpsProOrderBookAmount,
  formatPerpsProPrice,
} from '../../utils/format';
import type { PerpsProTradeAmountUnit } from '../../model/trade';

export const PERPS_PRO_ORDER_BOOK_ROW_HEIGHT = 20;

export const PerpsProOrderBookModeIcon: React.FC<{
  mode: PerpsOrderBookMode;
}> = ({ mode }) => {
  const { styles } = useTheme2024({ getStyle });
  const state = getPerpsOrderBookModeIconState(mode);

  return (
    <View style={styles.modeIcon}>
      <View style={styles.modeGuide} testID="perps-pro-order-book-mode-guide">
        {state.left.map((_tone, row) => (
          <View key={row} style={[styles.modeGuideBar, styles.modeNeutral]} />
        ))}
      </View>
      <View
        style={[
          styles.modeSides,
          state.right === 'ask'
            ? styles.modeAsk
            : state.right === 'bid'
            ? styles.modeBid
            : null,
        ]}
        testID="perps-pro-order-book-mode-sides">
        {state.right === 'split' ? (
          <>
            <View style={[styles.modeSideBar, styles.modeAsk]} />
            <View style={[styles.modeSideBar, styles.modeBid]} />
          </>
        ) : null}
      </View>
    </View>
  );
};

export const PerpsProOrderBookRow: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  amountDecimals?: number;
  level?: PerpsOrderBookLevel;
  maxTotal: number;
  onSelectPrice?: (price: string | null) => void;
  onSelectPriceIntentStart?: () => void;
  priceDecimals: number;
  side: 'ask' | 'bid';
}> = ({
  amountUnit = 'quote',
  amountDecimals = 2,
  level,
  maxTotal,
  onSelectPrice,
  onSelectPriceIntentStart,
  priceDecimals,
  side,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const depth = level ? getPerpsOrderBookDepthPercent(level, maxTotal) : 0;
  const depthStyle = useMemo<ViewStyle>(
    () => ({ width: `${depth}%` }),
    [depth],
  );

  return (
    <Pressable
      accessibilityRole={onSelectPrice ? 'button' : undefined}
      disabled={!onSelectPrice}
      onPressIn={onSelectPriceIntentStart}
      onPress={() => onSelectPrice?.(level?.price ?? null)}
      style={styles.bookRow}
      testID="perps-pro-order-book-row">
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
          level
            ? side === 'bid'
              ? styles.bidPrice
              : styles.askPrice
            : styles.placeholder,
        ]}>
        {level ? formatPerpsProPrice(level.priceNumber, priceDecimals) : '--'}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.bookAmount, level ? null : styles.placeholder]}>
        {level
          ? formatPerpsProOrderBookAmount(
              amountUnit === 'base' ? level.size : level.usdSize,
              amountDecimals,
            )
          : '--'}
      </Text>
    </Pressable>
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
    borderRadius: 1,
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
    padding: 2,
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
    fontFamily: FontNames.sf_pro,
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
  placeholder: {
    color: colors2024['neutral-secondary'],
  },
  bookAmount: {
    color: colors2024['neutral-title-1'],
    flexShrink: 0,
    fontFamily: FontNames.sf_pro,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'right',
    zIndex: 1,
  },
}));
