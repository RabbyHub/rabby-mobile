import React from 'react';
import {
  SectionList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type SectionListData,
  type SectionListProps,
  type SectionListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';

import { type SceneTabKey } from './context';
import {
  useSceneScrollSurface,
  type SceneScrollSurfaceHandle,
} from './useSceneScrollSurface';

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList as unknown as React.ComponentClass<SectionListProps<any, any>>,
) as unknown as React.ComponentType<
  SectionListProps<any, any> & { ref?: React.Ref<SectionList<any, any>> }
>;

export type SceneSection<ItemT> = {
  key: string;
  data: readonly ItemT[];
};

export type SceneSectionListHandle = SceneScrollSurfaceHandle & {
  scrollToOffset: (offset: number, animated?: boolean) => void;
};

export type SceneSectionListProps<ItemT> = {
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetTop?: number;
  initialNumToRender?: number;
  keyboardShouldPersistTaps?: SectionListProps<ItemT>['keyboardShouldPersistTaps'];
  keyExtractor?: (item: ItemT, index: number) => string;
  nativeRef?: AnimatedRef<any>;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMomentumScrollEnd?: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ref?: React.Ref<SceneSectionListHandle>;
  renderItem: SectionListRenderItem<ItemT, SceneSection<ItemT>>;
  renderSectionHeader?: (info: {
    section: SectionListData<ItemT, SceneSection<ItemT>>;
  }) => React.ReactElement | null;
  scrollEnabled?: boolean;
  scrollsToTop?: boolean;
  sections: readonly SceneSection<ItemT>[];
  showsVerticalScrollIndicator?: boolean;
  stickySectionHeadersEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tabKey: SceneTabKey;
  testID?: string;
};

export const SceneSectionList = <ItemT,>({
  ListHeaderComponent,
  contentContainerStyle,
  contentInsetTop = 0,
  initialNumToRender,
  keyboardShouldPersistTaps,
  keyExtractor,
  nativeRef,
  onContentSizeChange,
  onLayout,
  onMomentumScrollEnd,
  onScrollBeginDrag,
  onScrollEndDrag,
  ref,
  renderItem,
  renderSectionHeader,
  scrollEnabled = true,
  scrollsToTop,
  sections,
  showsVerticalScrollIndicator = false,
  stickySectionHeadersEnabled = true,
  style,
  tabKey,
  testID,
}: SceneSectionListProps<ItemT>) => {
  const { resolvedRef, scrollHandler, scrollTo } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });

  React.useImperativeHandle(
    ref,
    () => ({ scrollTo, scrollToOffset: scrollTo }),
    [scrollTo],
  );

  return (
    <AnimatedSectionList
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      initialNumToRender={initialNumToRender}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyExtractor={keyExtractor}
      onContentSizeChange={(width, height) =>
        onContentSizeChange?.(width, height)
      }
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScroll={scrollHandler}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      ref={resolvedRef as never}
      renderItem={renderItem as never}
      renderSectionHeader={renderSectionHeader as never}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      scrollsToTop={scrollsToTop}
      sections={sections as never}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      stickySectionHeadersEnabled={stickySectionHeadersEnabled}
      style={style}
      testID={testID}
    />
  );
};
