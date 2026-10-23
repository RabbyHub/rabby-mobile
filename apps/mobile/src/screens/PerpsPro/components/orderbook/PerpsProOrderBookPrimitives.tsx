import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  getPerpsOrderBookModeIconState,
  type PerpsOrderBookMode,
} from '../../model/orderBook';
import {
  formatPerpsProOrderBookAmount,
  formatPerpsProPrice,
} from '../../utils/format';
import { usePerpsProOrderBookPercentAnimation } from './usePerpsProOrderBookPercentAnimation';

export const PERPS_PRO_ORDER_BOOK_ROW_HEIGHT = 20;

export const PerpsProOrderBookModeIcon: React.FC<{
  mode: PerpsOrderBookMode;
}> = React.memo(function PerpsProOrderBookModeIcon({ mode }) {
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
});

export const PerpsProOrderBookRow: React.FC<{
  amount: number;
  amountDecimals?: number;
  price: string | null;
  priceNumber: number;
  onSelectPrice?: (price: string | null) => void;
  onSelectPriceIntentStart?: (price: string | null) => void;
  priceDecimals: number;
  side: 'ask' | 'bid';
}> = React.memo(function PerpsProOrderBookRow({
  amount,
  amountDecimals = 2,
  price,
  priceNumber,
  onSelectPrice,
  onSelectPriceIntentStart,
  priceDecimals,
  side,
}) {
  const { styles } = useTheme2024({ getStyle });
  const handlePressIn = React.useCallback(
    () => onSelectPriceIntentStart?.(price),
    [onSelectPriceIntentStart, price],
  );
  const handlePress = React.useCallback(
    () => onSelectPrice?.(price),
    [onSelectPrice, price],
  );
  const hasPrice = price !== null;

  return (
    <Pressable
      accessibilityRole={onSelectPrice ? 'button' : undefined}
      disabled={!onSelectPrice}
      onPressIn={onSelectPriceIntentStart ? handlePressIn : undefined}
      onPress={onSelectPrice ? handlePress : undefined}
      style={styles.bookRow}
      testID="perps-pro-order-book-row">
      <Text
        numberOfLines={1}
        style={[
          styles.bookPrice,
          hasPrice
            ? side === 'bid'
              ? styles.bidPrice
              : styles.askPrice
            : styles.placeholder,
        ]}>
        {hasPrice ? formatPerpsProPrice(priceNumber, priceDecimals) : '--'}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.bookAmount, hasPrice ? null : styles.placeholder]}>
        {hasPrice
          ? formatPerpsProOrderBookAmount(amount, amountDecimals)
          : '--'}
      </Text>
    </Pressable>
  );
});

export const PerpsProOrderBookDepth: React.FC<{
  animationIdentity: string;
  price: string;
  targetPercent: number;
  rowIndex: number;
  side: 'ask' | 'bid';
}> = React.memo(function PerpsProOrderBookDepth({
  animationIdentity,
  price,
  targetPercent,
  rowIndex,
  side,
}) {
  const { styles } = useTheme2024({ getStyle });
  const animatedDepth = usePerpsProOrderBookPercentAnimation({
    animationIdentity,
    hasValue: true,
    targetPercent,
    valueIdentity: price,
  });
  const depthStyle = useAnimatedStyle(() => ({
    width: `${animatedDepth.value}%` as `${number}%`,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.depth,
        side === 'bid' ? styles.bidDepth : styles.askDepth,
        { top: rowIndex * PERPS_PRO_ORDER_BOOK_ROW_HEIGHT },
        depthStyle,
      ]}
      testID="perps-pro-order-book-depth"
    />
  );
});

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
    height: PERPS_PRO_ORDER_BOOK_ROW_HEIGHT,
    position: 'absolute',
    right: 0,
  },
  askDepth: {
    backgroundColor: colors2024['red-light-1'],
  },
  bidDepth: {
    backgroundColor: colors2024['green-light-1'],
  },
  bookPrice: {
    ...PERPS_PRO_NUMBER_STYLE,
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
  placeholder: {
    color: colors2024['neutral-secondary'],
  },
  bookAmount: {
    ...PERPS_PRO_NUMBER_STYLE,
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
