import { Text } from '@/components/Typography';
import type { PerpsCandleInterval } from '@/constant/perps';
import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, type LayoutChangeEvent } from 'react-native';

type ItemLayout = {
  width: number;
  x: number;
};

export const PERPS_PRO_KLINE_TOOLBAR_HEIGHT = 22;

export const PerpsProKlineToolbar: React.FC<{
  disabled?: boolean;
  interval: PerpsCandleInterval;
  onSelect: (interval: PerpsCandleInterval) => void;
}> = React.memo(({ disabled = false, interval, onSelect }) => {
  const { styles } = useTheme2024({ getStyle });
  const scrollRef = useRef<ScrollView>(null);
  const itemLayoutsRef = useRef(new Map<PerpsCandleInterval, ItemLayout>());
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
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      horizontal
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      testID="perps-pro-kline-toolbar">
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
  );
});

PerpsProKlineToolbar.displayName = 'PerpsProKlineToolbar';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexGrow: 0,
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  },
  content: {
    alignItems: 'center',
    gap: 8,
    minHeight: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    paddingHorizontal: 8,
  },
  option: {
    alignItems: 'center',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    minWidth: 40,
  },
  optionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  selectedOptionText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
}));
