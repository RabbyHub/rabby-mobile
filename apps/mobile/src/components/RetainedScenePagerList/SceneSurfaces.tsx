import React from 'react';
import {
  Animated as NativeAnimated,
  FlatList,
  SectionList,
  type FlatListProps,
  type ScrollViewProps,
  type SectionListProps,
} from 'react-native';
import { ScrollView as RNGHScrollView } from 'react-native-gesture-handler';
import Animated, { type AnimatedRef } from 'react-native-reanimated';
import {
  useNativeScrollMirror,
  useSceneScrollSurface,
} from '@rabby-wallet/rn-collapsible-scene-view';

const AnimatedRNGHScrollView = Animated.createAnimatedComponent(
  RNGHScrollView,
) as unknown as React.ComponentType<any>;

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList as unknown as React.ComponentClass<FlatListProps<any>>,
) as unknown as React.ComponentType<
  FlatListProps<any> & { ref?: React.Ref<FlatList<any>> }
>;

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList as unknown as React.ComponentClass<SectionListProps<any, any>>,
) as unknown as React.ComponentType<
  SectionListProps<any, any> & { ref?: React.Ref<SectionList<any, any>> }
>;

type GestureHandlers = {
  simultaneousHandlers?: React.ComponentProps<
    typeof RNGHScrollView
  >['simultaneousHandlers'];
  waitFor?: React.ComponentProps<typeof RNGHScrollView>['waitFor'];
};

type SceneSurfaceProps = GestureHandlers & {
  /** Scene tab this surface publishes its offset for. */
  tabKey: string;
  /** Space reserved for the collapsing/pinned scene layers. */
  contentInsetTop: number;
  /** Optional native clock shared with the scene overlay layers. */
  nativeScrollY?: NativeAnimated.Value;
};

type ListInstance = {
  getNativeScrollRef?: () => unknown;
};

const useSceneListRef = (
  resolvedRef: AnimatedRef<any>,
  nativeScrollY: NativeAnimated.Value | undefined,
) => {
  const nativeScroll = useNativeScrollMirror(nativeScrollY);
  const attachedRef = React.useRef(resolvedRef);
  const instanceRef = React.useRef<ListInstance | null>(null);

  const setRef = React.useCallback(
    (instance: ListInstance | null) => {
      instanceRef.current = instance;
      attachedRef.current(instance as never);
      nativeScroll.sync(instance);
    },
    [nativeScroll],
  );

  // Reanimated keeps its inner ref stable and does not re-attach a changed
  // forwarded ref on an existing list; transfer the live instance explicitly.
  React.useLayoutEffect(() => {
    if (attachedRef.current === resolvedRef) {
      return;
    }
    attachedRef.current(null as never);
    attachedRef.current = resolvedRef;
    if (instanceRef.current) {
      resolvedRef(instanceRef.current as never);
    }
  }, [resolvedRef]);

  return setRef;
};

const useGestureScrollComponent = ({
  simultaneousHandlers,
  waitFor,
}: GestureHandlers) =>
  React.useCallback(
    (scrollProps: ScrollViewProps) => (
      <AnimatedRNGHScrollView
        {...scrollProps}
        simultaneousHandlers={simultaneousHandlers}
        waitFor={waitFor}
      />
    ),
    [simultaneousHandlers, waitFor],
  );

/** Vertical `ScrollView` surface owned by one scene tab. */
export function SceneScrollViewSurface({
  tabKey,
  contentInsetTop,
  nativeScrollY: explicitNativeScrollY,
  nativeRef,
  contentContainerStyle,
  style,
  children,
  simultaneousHandlers,
  waitFor,
  ...rest
}: React.ComponentProps<typeof RNGHScrollView> &
  SceneSurfaceProps & {
    nativeRef?: AnimatedRef<RNGHScrollView>;
  }) {
  const nativeScrollY = explicitNativeScrollY;
  const { resolvedRef, scrollHandler } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });
  const setRef = useSceneListRef(resolvedRef, nativeScrollY);
  return (
    <AnimatedRNGHScrollView
      {...rest}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      onScroll={scrollHandler}
      ref={setRef as never}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      simultaneousHandlers={simultaneousHandlers}
      style={style}
      waitFor={waitFor}>
      {children}
    </AnimatedRNGHScrollView>
  );
}

/** Vertical `FlatList` surface owned by one scene tab. */
export function SceneFlatList<ItemT>({
  tabKey,
  contentInsetTop,
  nativeScrollY: explicitNativeScrollY,
  nativeRef,
  contentContainerStyle,
  style,
  simultaneousHandlers,
  waitFor,
  ...rest
}: FlatListProps<ItemT> &
  SceneSurfaceProps & {
    nativeRef?: AnimatedRef<FlatList<ItemT>>;
  }) {
  const nativeScrollY = explicitNativeScrollY;
  const { resolvedRef, scrollHandler } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });
  const setRef = useSceneListRef(resolvedRef, nativeScrollY);
  const renderScrollComponent = useGestureScrollComponent({
    simultaneousHandlers,
    waitFor,
  });
  return (
    <AnimatedFlatList
      {...(rest as FlatListProps<any>)}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      onScroll={scrollHandler}
      ref={setRef as never}
      renderScrollComponent={renderScrollComponent}
      scrollEventThrottle={16}
      style={style}
    />
  );
}

/** Vertical `SectionList` surface owned by one scene tab. */
export function SceneSectionList<
  ItemT,
  SectionT extends { key?: string } = { key?: string },
>({
  tabKey,
  contentInsetTop,
  nativeScrollY: explicitNativeScrollY,
  nativeRef,
  contentContainerStyle,
  style,
  simultaneousHandlers,
  waitFor,
  ...rest
}: SectionListProps<ItemT, SectionT> &
  SceneSurfaceProps & {
    nativeRef?: AnimatedRef<SectionList<ItemT, SectionT>>;
  }) {
  const nativeScrollY = explicitNativeScrollY;
  const { resolvedRef, scrollHandler } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });
  const setRef = useSceneListRef(resolvedRef, nativeScrollY);
  const renderScrollComponent = useGestureScrollComponent({
    simultaneousHandlers,
    waitFor,
  });
  return (
    <AnimatedSectionList
      {...(rest as SectionListProps<any, any>)}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      onScroll={scrollHandler}
      ref={setRef as never}
      renderScrollComponent={renderScrollComponent}
      scrollEventThrottle={16}
      style={style}
    />
  );
}
