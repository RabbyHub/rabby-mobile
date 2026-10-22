import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  ScenePagerList,
  type SceneListHandle,
} from '@rabby-wallet/rn-collapsible-scene-view';
import React, { useCallback } from 'react';
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

const rowKey = (item: { key: string }) => item.key;

export type PerpsProInfoSingleListHandle = SceneListHandle<unknown>;

type Props<Row extends { key: string }> = {
  activeTab: PerpsProInfoTab;
  contentContainerStyle?: StyleProp<ViewStyle>;
  rowsByTab: Record<PerpsProInfoTab, readonly Row[]>;
  listHeader: React.ReactElement;
  nativeRef: AnimatedRef<FlatList<unknown>>;
  nativeScrollY: Animated.Value;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onTabChange: (tab: PerpsProInfoTab) => void;
  ref?: React.Ref<PerpsProInfoSingleListHandle>;
  renderItem: ListRenderItem<Row>;
  rowStartOffset: number;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** One persistent native list. Only a gesture starting in its rows may change
 * tabs; trade/header vertical drags belong to the same native scroll surface.
 * Only rows move horizontally; the same native owner scrolls the bounded preview.
 */
export const PerpsProInfoSingleList = <Row extends { key: string }>({
  activeTab,
  contentContainerStyle,
  rowsByTab,
  listHeader,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  onTabChange,
  ref,
  renderItem,
  rowStartOffset,
  scrollOffset,
  style,
  testID,
}: Props<Row>) => {
  const changeTab = useCallback(
    (key: string) => onTabChange(key as PerpsProInfoTab),
    [onTabChange],
  );

  return (
    <ScenePagerList
      ListHeaderComponent={listHeader}
      contentContainerStyle={contentContainerStyle}
      contentInsetTop={0}
      dataByKey={rowsByTab}
      keys={PERPS_PRO_INFO_TABS}
      onIndexChange={changeTab}
      rowStartOffset={rowStartOffset}
      scrollOffset={scrollOffset}
      keyExtractor={rowKey}
      keyboardShouldPersistTaps="handled"
      nativeRef={nativeRef}
      nativeScrollY={nativeScrollY}
      onContentSizeChange={onContentSizeChange}
      onLayout={onLayout}
      ref={ref}
      renderItem={renderItem}
      scrollEnabled
      scrollsToTop
      style={style}
      tabKey={activeTab}
      testID={testID}
    />
  );
};
