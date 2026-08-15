import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';

import type { PerpsProMarketTab } from '../../model/market';

type MarketTabItem = Readonly<{
  id: PerpsProMarketTab;
  label: string;
}>;

type MarketTabFrames = Partial<Record<PerpsProMarketTab, LayoutRectangle>>;

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
  onChange: (tab: PerpsProMarketTab) => void;
  tabs: readonly MarketTabItem[];
}> = React.memo(({ activeTab, onChange, tabs }) => {
  const { styles } = useTheme2024({ getStyle });
  const scrollRef = useRef<GestureHandlerScrollView>(null);
  const [tabFrames, setTabFrames] = useState<MarketTabFrames>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const activeFrame = tabFrames[activeTab];

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
    scrollRef.current?.scrollTo({ animated: true, x });
  }, [activeFrame, contentWidth, viewportWidth]);

  useEffect(() => {
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
            {active ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </GestureHandlerScrollView>
  );
});

PerpsProMarketTabs.displayName = 'PerpsProMarketTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scroll: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    flexGrow: 0,
    marginTop: 10,
  },
  content: {
    gap: 14,
    paddingLeft: 16,
    paddingRight: 20,
  },
  tab: {
    alignItems: 'center',
    height: 40,
    paddingTop: 12,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  indicator: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 2,
    bottom: 0,
    height: 4,
    left: '50%',
    marginLeft: -10,
    position: 'absolute',
    width: 20,
  },
}));
