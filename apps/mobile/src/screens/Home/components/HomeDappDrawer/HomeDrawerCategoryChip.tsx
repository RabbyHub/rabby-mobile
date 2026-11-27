import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import RcIconFavoriteChipCC from '@/assets2024/icons/home/favorite-chip-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { DRAWER_CATEGORY_CHIP_HEIGHT } from './constants';

type HomeDrawerCategoryChipProps = {
  index: number;
  /** Position of the category strip's pager, in pages. */
  indexDecimal: SharedValue<number>;
  /** A text chip. Without a label the chip is the favorites star. */
  label?: string;
};

/**
 * One chip of the website category strip. The selected chip has a filled
 * background, bold dark text and, for favorites, an orange star.
 *
 * Both looks are mounted and cross-faded on the UI thread from the pager's
 * position, so a swipe between two categories hands the highlight over
 * without a render. The bold label is the one in the flow: the chip keeps
 * the same width whether it is selected or not.
 */
export const HomeDrawerCategoryChip = React.memo(
  function HomeDrawerCategoryChip({
    index,
    indexDecimal,
    label,
  }: HomeDrawerCategoryChipProps) {
    const { styles, colors2024 } = useTheme2024({ getStyle });

    const selectedStyle = useAnimatedStyle(
      () => ({
        opacity: Math.max(0, 1 - Math.abs(index - indexDecimal.value)),
      }),
      [index],
    );
    const unselectedStyle = useAnimatedStyle(
      () => ({
        opacity: Math.min(1, Math.abs(index - indexDecimal.value)),
      }),
      [index],
    );

    return (
      <View style={styles.chip}>
        <Animated.View style={[styles.background, selectedStyle]} />
        {label ? (
          <View>
            <Animated.View style={selectedStyle}>
              <Text style={styles.selectedLabel} numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, unselectedStyle]}>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
          </View>
        ) : (
          <View>
            <Animated.View style={selectedStyle}>
              <RcIconFavoriteChipCC
                width={16}
                height={18}
                color={colors2024['orange-default']}
              />
            </Animated.View>
            <Animated.View style={[styles.overlay, unselectedStyle]}>
              <RcIconFavoriteChipCC
                width={16}
                height={18}
                color={colors2024['neutral-info']}
              />
            </Animated.View>
          </View>
        )}
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  chip: {
    height: DRAWER_CATEGORY_CHIP_HEIGHT,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: colors2024['neutral-line'],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLabel: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
