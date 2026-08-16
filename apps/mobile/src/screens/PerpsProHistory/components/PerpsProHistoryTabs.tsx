import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProHistoryTab } from '../types';

const TABS: PerpsProHistoryTab[] = [
  'orders',
  'trade',
  'transaction',
  'funding',
];
const TAB_HORIZONTAL_PADDING = 15;
type PerpsProHistoryTabFrames = Partial<
  Record<PerpsProHistoryTab, LayoutRectangle>
>;

export const updatePerpsProHistoryTabFrame = (
  tab: PerpsProHistoryTab,
  event: LayoutChangeEvent,
  setTabFrames: React.Dispatch<React.SetStateAction<PerpsProHistoryTabFrames>>,
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

export const PerpsProHistoryTabs: React.FC<{
  activeTab: PerpsProHistoryTab;
  onChange: (tab: PerpsProHistoryTab) => void;
}> = React.memo(({ activeTab, onChange }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [tabFrames, setTabFrames] = useState<PerpsProHistoryTabFrames>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const scrollActiveTabIntoView = useCallback(
    (animated: boolean) => {
      const frame = tabFrames[activeTab];
      if (!frame || viewportWidth <= 0 || contentWidth <= viewportWidth) {
        return;
      }
      const maximumOffset = contentWidth - viewportWidth;
      const centeredOffset =
        frame.x + TAB_HORIZONTAL_PADDING - (viewportWidth - frame.width) / 2;
      scrollRef.current?.scrollTo({
        animated,
        x: Math.max(0, Math.min(maximumOffset, centeredOffset)),
      });
    },
    [activeTab, contentWidth, tabFrames, viewportWidth],
  );

  useEffect(() => {
    scrollActiveTabIntoView(false);
  }, [scrollActiveTabIntoView]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      onContentSizeChange={width => setContentWidth(width)}
      onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(tab => {
          const selected = activeTab === tab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onLayout={event =>
                updatePerpsProHistoryTabFrame(tab, event, setTabFrames)
              }
              onPress={() => {
                onChange(tab);
              }}
              style={styles.tab}
              testID={`perps-pro-history-tab-${tab}`}>
              <Text style={selected ? styles.activeText : styles.text}>
                {t(`page.perps.pro.history.tabs.${tab}`)}
              </Text>
              {selected ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
});

PerpsProHistoryTabs.displayName = 'PerpsProHistoryTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scroll: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  content: {
    minWidth: '100%',
    paddingHorizontal: TAB_HORIZONTAL_PADDING,
  },
  tabs: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    height: 34,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 1,
    paddingHorizontal: 2,
    paddingTop: 8,
    position: 'relative',
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 14,
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
    backgroundColor: colors2024['neutral-title-1'],
    bottom: 0,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
}));
