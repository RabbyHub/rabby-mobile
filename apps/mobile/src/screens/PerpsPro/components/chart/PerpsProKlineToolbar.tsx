import RcIconResetScale from '@/assets2024/icons/bridge/IconRefreshCC.svg';
import { Text } from '@/components/Typography';
import type { PerpsCandleInterval } from '@/constant/perps';
import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

export const PERPS_PRO_KLINE_TOOLBAR_HEIGHT = 22;
export const PERPS_PRO_KLINE_RESET_SLOT_WIDTH = 32;

export const PerpsProKlineToolbar: React.FC<{
  disabled?: boolean;
  interval: PerpsCandleInterval;
  onResetPriceScale: () => void;
  onSelect: (interval: PerpsCandleInterval) => void;
  showPriceScaleReset?: boolean;
}> = React.memo(
  ({
    disabled = false,
    interval,
    onResetPriceScale,
    onSelect,
    showPriceScaleReset = false,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
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
        <View
          style={styles.resetSlot}
          testID="perps-pro-kline-reset-price-scale-slot">
          {showPriceScaleReset ? (
            <Pressable
              accessibilityLabel={t('page.perps.pro.chart.resetPriceScale')}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              disabled={disabled}
              hitSlop={8}
              onPress={onResetPriceScale}
              style={styles.resetButton}
              testID="perps-pro-kline-reset-price-scale">
              <RcIconResetScale
                color={colors2024['neutral-body']}
                height={16}
                width={16}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  },
);

PerpsProKlineToolbar.displayName = 'PerpsProKlineToolbar';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  },
  intervalScroll: {
    flex: 1,
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  selectedOptionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  resetButton: {
    alignItems: 'center',
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    width: 24,
  },
  resetSlot: {
    flexShrink: 0,
    height: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    width: PERPS_PRO_KLINE_RESET_SLOT_WIDTH,
  },
}));
