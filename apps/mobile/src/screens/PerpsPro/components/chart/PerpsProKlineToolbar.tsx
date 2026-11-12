import { Text } from '@/components/Typography';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

type ItemLayout = {
  width: number;
  x: number;
};

export const PERPS_PRO_KLINE_TOOLBAR_HEIGHT = 36;
const TAP_DISTANCE = 12;

type ToolbarLayout = {
  items: (ItemLayout | null)[];
  viewportWidth: number;
  contentWidth: number;
  selectedIndex: number;
};

export const PerpsProKlineToolbar: React.FC<{
  disabled?: boolean;
  interval: PerpsCandleDataInterval;
  onSelect: (interval: PerpsCandleDataInterval) => void;
}> = React.memo(({ disabled = false, interval, onSelect }) => {
  const { styles } = useTheme2024({ getStyle });
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const layout = useSharedValue<ToolbarLayout>({
    items: [],
    viewportWidth: 0,
    contentWidth: 0,
    selectedIndex: -1,
  });
  const scrollOffset = useSharedValue(0);
  const touchActive = useSharedValue(false);
  const dragging = useSharedValue(false);
  const dragged = useSharedValue(false);
  const tappedIndex = useSharedValue(-1);
  const revealPending = useSharedValue(false);
  const selectInterval = useMemoizedFn((index: number) => {
    const option = PERPS_PRO_CANDLE_INTERVAL_OPTIONS[index];
    if (!disabled && option) {
      onSelect(option.value);
    }
  });

  const revealSelectedInterval = useCallback(() => {
    'worklet';
    if (touchActive.value || dragging.value) {
      revealPending.value = true;
      return;
    }
    revealPending.value = false;
    const { items, selectedIndex, viewportWidth, contentWidth } = layout.value;
    const item = items[selectedIndex];
    if (!item || viewportWidth <= 0 || contentWidth <= 0) {
      return;
    }
    // Keep visible tabs stationary. Only reveal the clipped edge, never center.
    const nextOffset = Math.max(
      0,
      Math.min(
        Math.max(0, contentWidth - viewportWidth),
        Math.min(
          item.x,
          Math.max(scrollOffset.value, item.x + item.width - viewportWidth),
        ),
      ),
    );
    if (nextOffset !== scrollOffset.value) {
      scrollOffset.value = nextOffset;
      scrollTo(scrollRef, nextOffset, 0, false);
    }
  }, [dragging, layout, revealPending, scrollOffset, scrollRef, touchActive]);

  useEffect(() => {
    runOnUI((selectedIndex: number) => {
      layout.value = { ...layout.value, selectedIndex };
      revealSelectedInterval();
    })(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.findIndex(
        item => item.value === interval,
      ),
    );
  }, [interval, layout, revealSelectedInterval]);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: event => {
      if (
        touchActive.value &&
        dragging.value &&
        Math.abs(event.contentOffset.x - scrollOffset.value) > 0.5
      ) {
        dragged.value = true;
      }
      scrollOffset.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      // Android also emits this when DOWN intercepts a fling. Only actual
      // scrolling during this touch cancels a tap, not the begin event alone.
      dragging.value = true;
    },
    onEndDrag: () => {
      dragging.value = false;
      if (revealPending.value) {
        revealSelectedInterval();
      }
    },
  });

  const nativeScroll = useMemo(
    () =>
      Gesture.Native()
        .disallowInterruption(false)
        .onFinalize(() => {
          // Cancellation by the sheet pan need not deliver onScrollEndDrag.
          dragging.value = false;
          if (revealPending.value) {
            revealSelectedInterval();
          }
        }),
    [dragging, revealPending, revealSelectedInterval],
  );
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .maxDistance(TAP_DISTANCE)
        .cancelsTouchesInView(false)
        .simultaneousWithExternalGesture(nativeScroll)
        .onBegin(event => {
          touchActive.value = true;
          dragged.value = false;
          const offset = Math.max(
            0,
            Math.min(
              scrollOffset.value,
              Math.max(
                0,
                layout.value.contentWidth - layout.value.viewportWidth,
              ),
            ),
          );
          scrollOffset.value = offset;
          scrollTo(scrollRef, offset, 0, false);
          const x = event.x + offset;
          tappedIndex.value = layout.value.items.findIndex(
            item => item != null && x >= item.x && x < item.x + item.width,
          );
        })
        .onEnd((event, success) => {
          const index = tappedIndex.value;
          const item = layout.value.items[index];
          const x = event.x + scrollOffset.value;
          if (
            success &&
            !dragged.value &&
            item &&
            x >= item.x &&
            x < item.x + item.width
          ) {
            runOnJS(selectInterval)(index);
          }
        })
        .onFinalize(() => {
          touchActive.value = false;
          tappedIndex.value = -1;
          if (revealPending.value) {
            revealSelectedInterval();
          }
        }),
    [
      disabled,
      dragged,
      layout,
      nativeScroll,
      revealPending,
      revealSelectedInterval,
      scrollOffset,
      scrollRef,
      selectInterval,
      tappedIndex,
      touchActive,
    ],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      runOnUI((viewportWidth: number) => {
        layout.value = { ...layout.value, viewportWidth };
        revealSelectedInterval();
      })(event.nativeEvent.layout.width);
    },
    [layout, revealSelectedInterval],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      runOnUI((contentWidth: number) => {
        layout.value = { ...layout.value, contentWidth };
        revealSelectedInterval();
      })(width);
    },
    [layout, revealSelectedInterval],
  );

  return (
    // Recognize taps on the stationary viewport, outside ScrollView's JS
    // responder capture (which otherwise consumes the tap that stops inertia).
    <GestureDetector gesture={tap}>
      <View
        collapsable={false}
        style={styles.container}
        testID="perps-pro-kline-toolbar">
        <GestureDetector gesture={nativeScroll}>
          <Animated.ScrollView
            ref={scrollRef}
            bounces={false}
            contentContainerStyle={styles.content}
            directionalLockEnabled
            horizontal
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={styles.intervalScroll}
            testID="perps-pro-kline-interval-scroll">
            {PERPS_PRO_CANDLE_INTERVAL_OPTIONS.map((option, index) => {
              const selected = option.value === interval;
              return (
                <View
                  key={option.value}
                  accessible
                  accessibilityActions={[{ name: 'activate' }]}
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  onAccessibilityAction={event => {
                    if (event.nativeEvent.actionName === 'activate') {
                      selectInterval(index);
                    }
                  }}
                  onAccessibilityTap={() => selectInterval(index)}
                  onLayout={event => {
                    const { width, x } = event.nativeEvent.layout;
                    runOnUI((itemIndex: number, item: ItemLayout) => {
                      const items = [...layout.value.items];
                      items[itemIndex] = item;
                      layout.value = { ...layout.value, items };
                      revealSelectedInterval();
                    })(index, { width, x });
                  }}
                  style={styles.option}
                  testID={`perps-pro-kline-interval-${option.value}`}>
                  <Text
                    style={[
                      styles.optionText,
                      selected ? styles.selectedOptionText : null,
                    ]}>
                    {option.label}
                  </Text>
                </View>
              );
            })}
          </Animated.ScrollView>
        </GestureDetector>
      </View>
    </GestureDetector>
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
    minHeight: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  },
  option: {
    alignItems: 'center',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 16,
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
