import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  Text as NativeText,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { PerpsProMarketTab } from '../../model/market';
import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';
import { getPerpsProFontStyle } from '../common/perpsProVisual';

type MarketTabItem = Readonly<{
  id: PerpsProMarketTab;
  label: string;
}>;

type MarketTabFrames = Partial<Record<PerpsProMarketTab, LayoutRectangle>>;

type MarketTabScrollPosition = Readonly<{
  tab: PerpsProMarketTab;
  x: number;
}>;

const MARKET_TAB_REGULAR_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '400');
const MARKET_TAB_MEDIUM_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '500');

const PerpsProMarketTabLabel: React.FC<{
  activeColor: string;
  index: number;
  inactiveColor: string;
  indicatorPosition: SharedValue<number>;
  label: string;
  style: StyleProp<TextStyle>;
  tabCount: number;
}> = React.memo(
  ({
    activeColor,
    index,
    inactiveColor,
    indicatorPosition,
    label,
    style,
    tabCount,
  }) => {
    const animatedStyle = useAnimatedStyle(() => {
      // The label and underline intentionally share one UI-thread visual
      // position; activeTab remains the business/accessibility selection.
      const maximumIndex = Math.max(0, tabCount - 1);
      const rawPosition = Number.isFinite(indicatorPosition.value)
        ? indicatorPosition.value
        : 0;
      const visualIndex = Math.round(
        Math.max(0, Math.min(maximumIndex, rawPosition)),
      );
      const active = visualIndex === index;

      return {
        color: active ? activeColor : inactiveColor,
        fontFamily: active
          ? MARKET_TAB_MEDIUM_FONT_STYLE.fontFamily
          : MARKET_TAB_REGULAR_FONT_STYLE.fontFamily,
        fontWeight: active
          ? MARKET_TAB_MEDIUM_FONT_STYLE.fontWeight
          : MARKET_TAB_REGULAR_FONT_STYLE.fontWeight,
      };
    }, [activeColor, inactiveColor, index, indicatorPosition, tabCount]);

    return (
      <View style={labelStyles.container}>
        <NativeText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          style={[style, labelStyles.measureText]}>
          {label}
        </NativeText>
        <Animated.Text
          numberOfLines={1}
          style={[style, labelStyles.visibleText, animatedStyle]}>
          {label}
        </Animated.Text>
      </View>
    );
  },
);

PerpsProMarketTabLabel.displayName = 'PerpsProMarketTabLabel';

const labelStyles = {
  container: {
    position: 'relative' as const,
  },
  measureText: {
    ...MARKET_TAB_MEDIUM_FONT_STYLE,
    opacity: 0,
  },
  visibleText: {
    left: 0,
    position: 'absolute' as const,
    right: 0,
    textAlign: 'center' as const,
    top: 0,
  },
};

export const getPerpsProMarketTabScrollOffset = ({
  contentWidth,
  frame,
  viewportWidth,
}: {
  contentWidth: number;
  frame: LayoutRectangle;
  viewportWidth: number;
}) => {
  if (viewportWidth <= 0 || contentWidth <= viewportWidth) {
    return null;
  }
  const maximumOffset = contentWidth - viewportWidth;
  const centeredOffset = frame.x - (viewportWidth - frame.width) / 2;
  return Math.max(0, Math.min(maximumOffset, centeredOffset));
};

export const updatePerpsProMarketTabFrame = (
  tab: PerpsProMarketTab,
  event: LayoutChangeEvent,
  setTabFrames: React.Dispatch<React.SetStateAction<MarketTabFrames>>,
) => {
  const { x, y, width, height } = event.nativeEvent.layout;
  const frame: LayoutRectangle = { x, y, width, height };

  setTabFrames(previous => {
    const current = previous[tab];
    if (
      current?.x === x &&
      current.y === y &&
      current.width === width &&
      current.height === height
    ) {
      return previous;
    }
    return {
      ...previous,
      [tab]: frame,
    };
  });
};

export const PerpsProMarketTabs: React.FC<{
  activeTab: PerpsProMarketTab;
  indicatorPosition: SharedValue<number>;
  onChange: (tab: PerpsProMarketTab) => void;
  tabs: readonly MarketTabItem[];
}> = React.memo(({ activeTab, indicatorPosition, onChange, tabs }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const scrollRef = useRef<GestureHandlerScrollView>(null);
  const lastScrollPositionRef = useRef<MarketTabScrollPosition | null>(null);
  const [tabFrames, setTabFrames] = useState<MarketTabFrames>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const activeFrame = tabFrames[activeTab];
  const indicatorLayouts = useMemo<
    readonly PerpsProTabIndicatorLayout[]
  >(() => {
    const layouts: PerpsProTabIndicatorLayout[] = [];
    for (const tab of tabs) {
      const frame = tabFrames[tab.id];
      if (!frame) {
        return [];
      }
      layouts.push({
        width: frame.width,
        x: frame.x,
      });
    }
    return layouts;
  }, [tabFrames, tabs]);

  const scrollActiveTabIntoView = useCallback(() => {
    if (!activeFrame) {
      return;
    }
    const x = getPerpsProMarketTabScrollOffset({
      contentWidth,
      frame: activeFrame,
      viewportWidth,
    });
    if (x === null) {
      return;
    }
    const lastPosition = lastScrollPositionRef.current;
    if (lastPosition?.x === x) {
      lastScrollPositionRef.current = { tab: activeTab, x };
      return;
    }
    if (!scrollRef.current) {
      return;
    }
    // Search mode unmounts this strip. Its first valid geometry is restored
    // in place; only a later controlled tab change should visibly animate.
    scrollRef.current.scrollTo({
      animated: lastPosition !== null && lastPosition.tab !== activeTab,
      x,
    });
    lastScrollPositionRef.current = { tab: activeTab, x };
  }, [activeFrame, activeTab, contentWidth, viewportWidth]);

  useLayoutEffect(() => {
    scrollActiveTabIntoView();
  }, [scrollActiveTabIntoView]);

  return (
    <GestureHandlerScrollView
      accessibilityRole="tablist"
      contentContainerStyle={styles.content}
      horizontal
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onContentSizeChange={width => setContentWidth(width)}
      onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      testID="perps-pro-market-tabs">
      {tabs.map((tab, index) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onLayout={event =>
              updatePerpsProMarketTabFrame(tab.id, event, setTabFrames)
            }
            onPress={() => onChange(tab.id)}
            style={styles.tab}
            testID={`perps-pro-market-tab-${tab.id}`}>
            <PerpsProMarketTabLabel
              activeColor={colors2024['neutral-title-1']}
              index={index}
              inactiveColor={colors2024['neutral-secondary']}
              indicatorPosition={indicatorPosition}
              label={tab.label}
              style={styles.text}
              tabCount={tabs.length}
            />
          </Pressable>
        );
      })}
      <PerpsProTabIndicator
        layouts={indicatorLayouts}
        position={indicatorPosition}
        style={styles.indicator}
        testID="perps-pro-market-tab-indicator"
      />
    </GestureHandlerScrollView>
  );
});

PerpsProMarketTabs.displayName = 'PerpsProMarketTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scroll: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    flexGrow: 0,
    height: 34,
  },
  content: {
    gap: 12,
    paddingHorizontal: 15,
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['neutral-body'],
    borderRadius: 1,
    bottom: 1,
    height: 2,
  },
}));
