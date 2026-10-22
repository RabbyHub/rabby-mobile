import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  SceneList,
  type SceneListHandle,
} from '@rabby-wallet/rn-collapsible-scene-view';
import React, { useMemo } from 'react';
import type {
  Animated,
  FlatList,
  LayoutChangeEvent,
  ListRenderItem,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';

export type PerpsProInfoSingleListHandle = SceneListHandle<unknown>;

type Props<Row extends { key: string }> = {
  activeTab: PerpsProInfoTab;
  contentContainerStyle?: StyleProp<ViewStyle>;
  data: readonly Row[];
  listHeader: React.ReactElement;
  nativeRef: AnimatedRef<FlatList<unknown>>;
  nativeScrollY: Animated.Value;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onSwipe: (direction: 'next' | 'prev') => void;
  ref?: React.Ref<PerpsProInfoSingleListHandle>;
  renderItem: ListRenderItem<Row>;
  rowStartOffset: number;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** One persistent native list. Only a gesture starting in its rows may change
 * tabs; trade/header vertical drags belong to the same native scroll surface.
 * Row-track previews and cross-level handoff are a subsequent phase.
 */
export const PerpsProInfoSingleList = <Row extends { key: string }>({
  activeTab,
  contentContainerStyle,
  data,
  listHeader,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  onSwipe,
  ref,
  renderItem,
  rowStartOffset,
  scrollOffset,
  style,
  testID,
}: Props<Row>) => {
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onTouchesDown((event, manager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (
            event.numberOfTouches !== 1 ||
            !touch ||
            touch.y + Math.max(0, scrollOffset.value) < rowStartOffset
          ) {
            manager.fail();
          }
        })
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((event, success) => {
          'worklet';
          if (success && Math.abs(event.translationX) >= 60) {
            runOnJS(onSwipe)(event.translationX < 0 ? 'next' : 'prev');
          }
        }),
    [onSwipe, rowStartOffset, scrollOffset],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <SceneList
        ListHeaderComponent={listHeader}
        contentContainerStyle={contentContainerStyle}
        contentInsetTop={0}
        data={data}
        keyExtractor={item => item.key}
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
    </GestureDetector>
  );
};
