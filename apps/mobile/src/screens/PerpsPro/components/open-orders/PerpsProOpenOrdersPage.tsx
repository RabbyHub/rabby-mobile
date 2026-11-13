import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  RetainedScenePagerBody,
  type RetainedScenePagerBodyHandle,
  type RetainedScenePagerPageContext,
} from '@/components/RetainedScenePagerList/RetainedScenePagerBody';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import type { PerpsProCollectionPresentation } from '../../model/infoPanelPresentation';
import { PerpsProOpenOrdersControls } from './PerpsProOpenOrdersControls';

type Category = 'basic' | 'conditional';
const CATEGORIES: readonly Category[] = ['basic', 'conditional'];
type ControlsProps = React.ComponentProps<typeof PerpsProOpenOrdersControls>;

type Props<Row extends { key: string }> = {
  context: RetainedScenePagerPageContext;
  controls: Omit<ControlsProps, 'onSetCategory'>;
  onCategoryChange: (category: Category) => void;
  identityKey: string;
  rowsByCategory: Record<Category, readonly Row[]>;
  presentationByCategory: Record<Category, PerpsProCollectionPresentation>;
  contentStyleByCategory: Record<Category, StyleProp<ViewStyle>>;
  renderItem: ListRenderItem<Row>;
  pinnedHeight: number;
  scrollOffset: SharedValue<number>;
};

/** A single controls block above two retained row lists. There is no vertical
 * list here: both child lists inherit the real outer SceneList cell/context.
 * Command hooks and sheet lifecycles remain owned by the Scene.
 */
export function PerpsProOpenOrdersPage<Row extends { key: string }>({
  context,
  controls,
  onCategoryChange,
  identityKey,
  rowsByCategory,
  presentationByCategory,
  contentStyleByCategory,
  renderItem,
  pinnedHeight,
  scrollOffset,
}: Props<Row>) {
  const pagerRef = useRef<RetainedScenePagerBodyHandle>(null);
  const [controlsHeight, setControlsHeight] = useState(0);
  const indicatorPosition = useSharedValue(
    CATEGORIES.indexOf(controls.category),
  );
  const gestureActive = useSharedValue(false);
  const showControls =
    presentationByCategory[controls.category] !== 'authoritativeEmpty';
  // Use the measured extent even while hidden controls retain their last
  // presentation. The native layout callback publishes removal as height zero.
  const controlsExtent = controlsHeight;
  const minimumPageHeight = Math.max(
    0,
    context.minimumPageHeight - controlsExtent,
  );
  const pageStyleByKey = useMemo(
    () => ({
      basic: {
        ...StyleSheet.flatten(contentStyleByCategory.basic),
        minHeight: minimumPageHeight,
      },
      conditional: {
        ...StyleSheet.flatten(contentStyleByCategory.conditional),
        minHeight: minimumPageHeight,
      },
    }),
    [contentStyleByCategory, minimumPageHeight],
  );
  const renderItemByKey = useMemo(
    () => ({ basic: renderItem, conditional: renderItem }),
    [renderItem],
  );
  const requestCategory = useCallback(
    (category: Category) => pagerRef.current?.selectTab(category),
    [],
  );
  const commitCategory = useCallback(
    (key: string) => {
      if (key === 'basic' || key === 'conditional') {
        onCategoryChange(key);
      }
    },
    [onCategoryChange],
  );

  return (
    <View
      testID="perps-pro-open-orders-page"
      collapsable={false}
      // scrollEnabled alone does not stop Android's nested pager host from
      // claiming touches. Reject them before they reach that native subtree.
      pointerEvents={context.interactive && showControls ? 'auto' : 'none'}>
      <View
        testID="perps-pro-open-orders-controls-layout"
        pointerEvents={context.interactive ? 'auto' : 'none'}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (Number.isFinite(height) && height >= 0) {
            setControlsHeight(height);
          }
        }}>
        <RenderActivityBoundary
          active={context.active}
          label="perps-pro-open-orders-controls">
          {showControls ? (
            <PerpsProOpenOrdersControls
              {...controls}
              onSetCategory={requestCategory}
            />
          ) : null}
        </RenderActivityBoundary>
      </View>
      <RetainedScenePagerBody
        ref={pagerRef}
        keys={CATEGORIES}
        activeKey={controls.category}
        activityEnabled={context.active}
        interactionEnabled={context.interactive && showControls}
        identityKey={identityKey}
        dataByKey={rowsByCategory}
        renderItemByKey={renderItemByKey}
        pageStyleByKey={pageStyleByKey}
        rowStartOffset={context.contentTop + controlsExtent}
        pinnedHeight={pinnedHeight}
        viewportHeight={context.viewportHeight}
        minimumPageHeight={minimumPageHeight}
        scrollOffset={scrollOffset}
        indicatorPosition={indicatorPosition}
        gestureActive={gestureActive}
        onTabChange={commitCategory}
        testID="perps-pro-open-orders"
      />
    </View>
  );
}
