import { Text } from '@/components/Typography';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  type LayoutChangeEvent,
  View,
} from 'react-native';

type ItemLayout = {
  width: number;
  x: number;
};

export const PERPS_PRO_KLINE_TOOLBAR_HEIGHT = 24;

export const PerpsProKlineToolbar: React.FC<{
  disabled?: boolean;
  interval: PerpsCandleDataInterval;
  onSelect: (interval: PerpsCandleDataInterval) => void;
}> = React.memo(({ disabled = false, interval, onSelect }) => {
  const { styles } = useTheme2024({ getStyle });
  const scrollRef = useRef<ScrollView>(null);
  const itemLayoutsRef = useRef(new Map<PerpsCandleDataInterval, ItemLayout>());
  const viewportWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const revealSelectedInterval = useCallback(() => {
    const layout = itemLayoutsRef.current.get(interval);
    const viewportWidth = viewportWidthRef.current;
    if (!layout || viewportWidth <= 0) {
      return;
    }
    const maxOffset = Math.max(0, contentWidthRef.current - viewportWidth);
    const centeredOffset = layout.x + layout.width / 2 - viewportWidth / 2;
    scrollRef.current?.scrollTo({
      animated: false,
      x: Math.max(0, Math.min(maxOffset, centeredOffset)),
    });
  }, [interval]);

  useEffect(() => {
    revealSelectedInterval();
  }, [revealSelectedInterval]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportWidthRef.current = event.nativeEvent.layout.width;
      revealSelectedInterval();
    },
    [revealSelectedInterval],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      contentWidthRef.current = width;
      revealSelectedInterval();
    },
    [revealSelectedInterval],
  );

  return (
    <View style={styles.container} testID="perps-pro-kline-toolbar">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        horizontal
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        showsHorizontalScrollIndicator={false}
        style={styles.intervalScroll}
        testID="perps-pro-kline-interval-scroll">
        {PERPS_PRO_CANDLE_INTERVAL_OPTIONS.map(option => {
          const selected = option.value === interval;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onLayout={event => {
                itemLayoutsRef.current.set(option.value, {
                  width: event.nativeEvent.layout.width,
                  x: event.nativeEvent.layout.x,
                });
                if (selected) {
                  revealSelectedInterval();
                }
              }}
              onPress={() => onSelect(option.value)}
              style={styles.option}
              testID={`perps-pro-kline-interval-${option.value}`}>
              <Text
                style={[
                  styles.optionText,
                  selected ? styles.selectedOptionText : null,
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

PerpsProKlineToolbar.displayName = 'PerpsProKlineToolbar';

// Figma 86356:121791: 12/16 Medium secondary, selected Bold title-1.
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  },
  intervalScroll: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: 28,
    minHeight: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    paddingHorizontal: 16,
  },
  option: {
    alignItems: 'center',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    justifyContent: 'center',
  },
  optionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  selectedOptionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));
