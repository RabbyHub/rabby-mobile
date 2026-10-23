import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  RetainedScenePagerList,
  type RetainedScenePagerListHandle,
} from '@/components/RetainedScenePagerList/RetainedScenePagerList';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type {
  Animated,
  FlatList,
  LayoutChangeEvent,
  ListRenderItem,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

const getPageContentStyle = (
  style: StyleProp<ViewStyle>,
  rowStartOffset: number,
): ViewStyle => {
  const wholeContent = StyleSheet.flatten(style);
  return {
    ...wholeContent,
    minHeight: Math.max(
      0,
      (typeof wholeContent?.minHeight === 'number'
        ? wholeContent.minHeight
        : 0) - rowStartOffset,
    ),
  };
};

export type PerpsProInfoSingleListHandle = RetainedScenePagerListHandle;

type Props<Row extends { key: string }> = {
  activeTab: PerpsProInfoTab;
  contentStyleByTab: Record<PerpsProInfoTab, StyleProp<ViewStyle>>;
  activityEnabled: boolean;
  identityKey: string;
  pinnedHeight: number;
  indicatorPosition: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  rowsByTab: Record<PerpsProInfoTab, readonly Row[]>;
  listHeader: React.ReactElement;
  nativeRef: AnimatedRef<FlatList<unknown>>;
  nativeScrollY: Animated.Value;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onTabChange: (tab: PerpsProInfoTab) => void;
  ref?: React.Ref<PerpsProInfoSingleListHandle>;
  renderItemByTab: Record<PerpsProInfoTab, ListRenderItem<Row>>;
  rowStartOffset: number;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** One persistent native vertical owner, with retained virtualized row pages.
 * Header/trade stay outside the native horizontal pager.
 */
export const PerpsProInfoSingleList = <Row extends { key: string }>({
  activeTab,
  contentStyleByTab,
  activityEnabled,
  identityKey,
  pinnedHeight,
  indicatorPosition,
  gestureActive,
  rowsByTab,
  listHeader,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  onTabChange,
  ref,
  renderItemByTab,
  rowStartOffset,
  scrollOffset,
  style,
  testID,
}: Props<Row>) => {
  const changeTab = useCallback(
    (key: string) => onTabChange(key as PerpsProInfoTab),
    [onTabChange],
  );
  const positionsStyle = useMemo(
    () => getPageContentStyle(contentStyleByTab.positions, rowStartOffset),
    [contentStyleByTab.positions, rowStartOffset],
  );
  const ordersStyle = useMemo(
    () => getPageContentStyle(contentStyleByTab.openOrders, rowStartOffset),
    [contentStyleByTab.openOrders, rowStartOffset],
  );
  const accountStyle = useMemo(
    () => getPageContentStyle(contentStyleByTab.account, rowStartOffset),
    [contentStyleByTab.account, rowStartOffset],
  );
  const pageStyleByKey = useMemo(
    () => ({
      positions: positionsStyle,
      openOrders: ordersStyle,
      account: accountStyle,
    }),
    [positionsStyle, ordersStyle, accountStyle],
  );

  return (
    <RetainedScenePagerList
      listHeader={listHeader}
      activeKey={activeTab}
      activityEnabled={activityEnabled}
      identityKey={identityKey}
      pageStyleByKey={pageStyleByKey}
      pinnedHeight={pinnedHeight}
      indicatorPosition={indicatorPosition}
      gestureActive={gestureActive}
      dataByKey={rowsByTab}
      keys={PERPS_PRO_INFO_TABS}
      onTabChange={changeTab}
      rowStartOffset={rowStartOffset}
      scrollOffset={scrollOffset}
      nativeRef={nativeRef}
      nativeScrollY={nativeScrollY}
      onContentSizeChange={onContentSizeChange}
      onLayout={onLayout}
      ref={ref}
      renderItemByKey={renderItemByTab}
      style={style}
      testID={testID}
    />
  );
};
