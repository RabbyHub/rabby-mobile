import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  SectionList,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/**
 * Collapsed-tab-view replacement for `PerpsProInfoPager`.
 *
 * One vertical scroll surface owns the whole scene: the header, market bar and
 * trade panel are real scroll content, the tab strip is the single sticky
 * header, and horizontal swipes are recognised inside this component. There is
 * no pager, no sticky overlay and no cross-page offset preparation, so nothing
 * has to chase the scroll offset and a tab switch cannot move another tab.
 *
 * Each tab keeps its own vertical offset in memory and restores it when the tab
 * becomes active again.
 */
export type PerpsProCollapsedTabViewHandle = {
  scrollToTop(animated?: boolean): void;
  getActiveScrollOffset(): number;
};

export const PerpsProCollapsedTabView = <Row,>({
  activeTab,
  contentContainerStyle,
  dataByTab,
  onTabChange,
  onScrollEnd,
  ref,
  renderHeaderContent,
  renderRow,
  renderTabs,
  style,
}: {
  activeTab: PerpsProInfoTab;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dataByTab: Record<PerpsProInfoTab, ReadonlyArray<Row>>;
  onTabChange: (tab: PerpsProInfoTab) => void;
  onScrollEnd?: (tab: PerpsProInfoTab, offset: number) => void;
  ref?: React.Ref<PerpsProCollapsedTabViewHandle>;
  renderHeaderContent: (tab: PerpsProInfoTab) => ReactElement;
  renderRow: (row: Row) => ReactElement;
  renderTabs: (tab: PerpsProInfoTab) => ReactElement;
  style?: StyleProp<ViewStyle>;
}) => {
  const listRef = useRef<SectionList<Row> | null>(null);
  const offsetsRef = useRef<Record<PerpsProInfoTab, number>>({
    account: 0,
    openOrders: 0,
    positions: 0,
  });
  const activeOffsetRef = useRef(0);
  const [tab, setTab] = useState(activeTab);
  const pendingRestoreRef = useRef<PerpsProInfoTab | null>(null);

  // Follow the externally selected tab (e.g. a persistence echo).
  useEffect(() => {
    setTab(current => {
      if (current === activeTab) {
        return current;
      }
      pendingRestoreRef.current = activeTab;
      return activeTab;
    });
  }, [activeTab]);

  // Restore the incoming tab's offset once its data is on screen.
  useEffect(() => {
    if (pendingRestoreRef.current !== tab) {
      return;
    }
    pendingRestoreRef.current = null;
    const offset = offsetsRef.current[tab] ?? 0;
    activeOffsetRef.current = offset;
    (
      listRef.current as unknown as {
        scrollToOffset?: (p: { animated: boolean; offset: number }) => void;
      }
    )?.scrollToOffset?.({ animated: false, offset });
  }, [tab, dataByTab]);

  const switchTab = useCallback(
    (next: PerpsProInfoTab) => {
      if (next === tab) {
        return;
      }
      offsetsRef.current[tab] = activeOffsetRef.current;
      pendingRestoreRef.current = next;
      setTab(next);
      onTabChange(next);
    },
    [onTabChange, tab],
  );

  const switchToAdjacent = useCallback(
    (direction: -1 | 1) => {
      const index = PERPS_PRO_INFO_TABS.indexOf(tab);
      const next = PERPS_PRO_INFO_TABS[index + direction];
      if (next) {
        switchTab(next);
      }
    },
    [switchTab, tab],
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd(event => {
          'worklet';
          const { translationX, velocityX } = event;
          const shouldSwitch =
            Math.abs(translationX) > 60 || Math.abs(velocityX) > 600;
          if (!shouldSwitch) {
            return;
          }
          const direction = translationX < 0 ? 1 : -1;
          // The gesture runs on the UI thread; hop back once per completed
          // swipe instead of per frame.
          runOnJS(switchToAdjacent)(direction);
        }),
    [switchToAdjacent],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      activeOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    },
    [],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y);
      activeOffsetRef.current = offset;
      offsetsRef.current[tab] = offset;
      onScrollEnd?.(tab, offset);
    },
    [onScrollEnd, tab],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      getActiveScrollOffset: () => activeOffsetRef.current,
      scrollToTop(animated = true) {
        (
          listRef.current as unknown as {
            scrollToOffset?: (p: { animated: boolean; offset: number }) => void;
          }
        )?.scrollToOffset?.({ animated, offset: 0 });
        activeOffsetRef.current = 0;
        offsetsRef.current[tab] = 0;
      },
    }),
    [tab],
  );

  const sections = useMemo(
    () => [{ data: dataByTab[tab] as Row[], key: tab }],
    [dataByTab, tab],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View collapsable={false} style={style} testID="perps-pro-tab-view">
        <SectionList<Row>
          contentContainerStyle={contentContainerStyle}
          initialNumToRender={6}
          keyExtractor={(item, index) =>
            String((item as { key?: string })?.key ?? index)
          }
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={renderHeaderContent(tab)}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          ref={listRef}
          renderItem={({ item }) => renderRow(item)}
          renderSectionHeader={() => renderTabs(tab)}
          scrollEventThrottle={16}
          sections={sections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          testID={`perps-pro-tab-list-${tab}`}
        />
      </View>
    </GestureDetector>
  );
};
