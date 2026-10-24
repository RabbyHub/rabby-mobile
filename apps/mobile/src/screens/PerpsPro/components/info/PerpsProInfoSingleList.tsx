import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  LinkedScenePagerList,
  type LinkedScenePagerListHandle,
} from '@/components/RetainedScenePagerList/LinkedScenePagerList';
import { RetainedRows } from '@/components/RetainedScenePagerList/RetainedScenePagerBody';
import type {
  LinkedScenePage,
  LinkedScenePath,
  LinkedScenePageContext,
  LinkedSceneGroupContext,
  LinkedScenePagingMode,
} from '@rabby-wallet/rn-collapsible-scene-view';
import React, { memo, useCallback, useMemo, useRef } from 'react';
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
import type { PerpsProCollectionPresentation } from '../../model/infoPanelPresentation';
import { PerpsProOpenOrdersControls } from '../open-orders/PerpsProOpenOrdersControls';

type Category = 'basic' | 'conditional';
type ControlsProps = React.ComponentProps<typeof PerpsProOpenOrdersControls>;
export type PerpsProLinkedOrders<Row extends { key: string }> = {
  controls: Omit<ControlsProps, 'onSetCategory'>;
  onCategoryChange: (category: Category) => void;
  rowsByCategory: Record<Category, readonly Row[]>;
  presentationByCategory: Record<Category, PerpsProCollectionPresentation>;
  contentStyleByCategory: Record<Category, StyleProp<ViewStyle>>;
};

const SIMPLE_PAGES: readonly LinkedScenePage[] = [
  { key: 'positions' },
  { key: 'openOrders' },
  { key: 'account' },
];
const GROUPED_PAGES: readonly LinkedScenePage[] = [
  { key: 'positions' },
  { key: 'openOrders', children: [{ key: 'basic' }, { key: 'conditional' }] },
  { key: 'account' },
];
const ignoreMeasure = () => {};

export type PerpsProInfoSingleListHandle = LinkedScenePagerListHandle;

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
  openOrders: PerpsProLinkedOrders<Row>;
  pagingMode?: LinkedScenePagingMode;
  rowStartOffset: number;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** One vertical owner and one business page tree, independent of presentation. */
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
  openOrders,
  pagingMode = 'flat',
  rowStartOffset,
  scrollOffset,
  style,
  testID = 'perps-pro-info-list',
}: Props<Row>) => {
  const pagerRef = useRef<LinkedScenePagerListHandle>(null);
  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (offset, animated) =>
        pagerRef.current?.scrollTo(offset, animated),
      scrollToOffset: (offset, animated) =>
        pagerRef.current?.scrollToOffset(offset, animated),
      selectPath: path => pagerRef.current?.selectPath(path),
      // Clicking the parent restores the remembered category. Swiping continues
      // to use adjacency on the physical track, not this remembered preference.
      selectTab: key =>
        pagerRef.current?.selectPath({
          key,
          ...(key === 'openOrders'
            ? { childKey: openOrders.controls.category }
            : {}),
        }),
    }),
    [openOrders.controls.category],
  );
  // Only authoritative emptiness of the whole collection removes the category
  // UI. A zero-count category or a symbol filter never removes a physical leaf.
  const grouped =
    openOrders.presentationByCategory.basic !== 'authoritativeEmpty' ||
    openOrders.presentationByCategory.conditional !== 'authoritativeEmpty';
  const activePath = useMemo(
    () => ({
      key: activeTab,
      ...(activeTab === 'openOrders' && grouped
        ? { childKey: openOrders.controls.category }
        : {}),
    }),
    [activeTab, grouped, openOrders.controls.category],
  );
  const { onCategoryChange } = openOrders;
  const changePath = useCallback(
    (path: LinkedScenePath) => {
      if (
        path.key === 'openOrders' &&
        (path.childKey === 'basic' || path.childKey === 'conditional')
      ) {
        onCategoryChange(path.childKey);
      }
      onTabChange(path.key as PerpsProInfoTab);
    },
    [onTabChange, onCategoryChange],
  );
  const renderLeaf = useCallback(
    (path: LinkedScenePath, context: LinkedScenePageContext) => {
      const tab = path.key as PerpsProInfoTab;
      const category =
        path.childKey === 'conditional' ? 'conditional' : 'basic';
      const isOrderChild = tab === 'openOrders' && path.childKey !== undefined;
      return (
        <LinkedPerpsRows
          data={
            isOrderChild ? openOrders.rowsByCategory[category] : rowsByTab[tab]
          }
          renderItem={renderItemByTab[tab]}
          active={context.active}
          identityKey={identityKey}
          contentStyle={
            isOrderChild
              ? openOrders.contentStyleByCategory[category]
              : contentStyleByTab[tab]
          }
          contentTop={context.contentTop}
          minimumPageHeight={context.minimumPageHeight}
          testID={
            tab === 'openOrders'
              ? `perps-pro-open-orders-rows-${
                  isOrderChild ? category : openOrders.controls.category
                }`
              : `${testID}-rows-${tab}`
          }
        />
      );
    },
    [
      contentStyleByTab,
      identityKey,
      openOrders.contentStyleByCategory,
      openOrders.controls.category,
      openOrders.rowsByCategory,
      renderItemByTab,
      rowsByTab,
      testID,
    ],
  );
  const renderGroupHeader = useCallback(
    (key: string, context: LinkedSceneGroupContext) =>
      key === 'openOrders' ? (
        <PerpsProOpenOrdersControls
          {...openOrders.controls}
          category={
            context.childKey === 'conditional' ? 'conditional' : 'basic'
          }
          onSetCategory={context.selectChild}
        />
      ) : null,
    [openOrders.controls],
  );

  return (
    <LinkedScenePagerList
      listHeader={listHeader}
      pages={grouped ? GROUPED_PAGES : SIMPLE_PAGES}
      activePath={activePath}
      pagingMode={pagingMode}
      activityEnabled={activityEnabled}
      pinnedHeight={pinnedHeight}
      indicatorPosition={indicatorPosition}
      gestureActive={gestureActive}
      onPathChange={changePath}
      contentTop={rowStartOffset}
      scrollOffset={scrollOffset}
      nativeRef={nativeRef}
      nativeScrollY={nativeScrollY}
      onContentSizeChange={onContentSizeChange}
      onLayout={onLayout}
      ref={pagerRef}
      renderLeaf={renderLeaf}
      renderGroupHeader={renderGroupHeader}
      style={style}
      testID={testID}
    />
  );
};

function LinkedPerpsRowsContent<Row extends { key: string }>({
  contentStyle,
  contentTop,
  minimumPageHeight,
  ...props
}: {
  data: readonly Row[];
  renderItem: ListRenderItem<Row>;
  active: boolean;
  identityKey: string;
  contentStyle: StyleProp<ViewStyle>;
  contentTop: number;
  minimumPageHeight: number;
  testID: string;
}) {
  const pageStyle = useMemo(() => {
    const whole = StyleSheet.flatten(contentStyle);
    return {
      ...whole,
      minHeight: Math.max(
        minimumPageHeight,
        (typeof whole?.minHeight === 'number' ? whole.minHeight : 0) -
          contentTop,
      ),
    };
  }, [contentStyle, contentTop, minimumPageHeight]);
  return (
    <RetainedRows
      {...props}
      pageStyle={pageStyle}
      top={0}
      index={0}
      measure={ignoreMeasure}
    />
  );
}

const LinkedPerpsRows = memo(
  LinkedPerpsRowsContent,
) as typeof LinkedPerpsRowsContent;
