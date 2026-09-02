import { Text } from '@/components/Typography';
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
  Pressable,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import type { PerpsProMarketTab } from '../../model/market';
import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';

type MarketTabItem = Readonly<{
  id: PerpsProMarketTab;
  label: string;
}>;

type MarketTabFrames = Partial<Record<PerpsProMarketTab, LayoutRectangle>>;

type MarketTabScrollPosition = Readonly<{
  tab: PerpsProMarketTab;
  x: number;
}>;

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
  const { styles } = useTheme2024({ getStyle });
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
        width: 20,
        x: frame.x + (frame.width - 20) / 2,
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
      {tabs.map(tab => {
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
            <Text style={active ? styles.activeText : styles.text}>
              {tab.label}
            </Text>
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
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['neutral-body'],
    borderRadius: 1,
    bottom: 1,
    height: 2,
  },
}));
