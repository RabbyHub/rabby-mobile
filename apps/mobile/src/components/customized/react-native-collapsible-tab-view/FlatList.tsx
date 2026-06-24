// patch from file:///./../../../../node_modules/react-native-collapsible-tab-view/src/FlatList.tsx

import React, { type Ref } from 'react';
import Animated from 'react-native-reanimated';

import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from 'react-native-collapsible-tab-view/src/hooks';
import { RNGHFlatList } from '../reexports';
import { useScrollHandlerY } from './hooks';

type RNGHFlatListProps<T> = React.ComponentProps<typeof RNGHFlatList<T>>;
const AnimatedRNGHFlatList =
  Animated.createAnimatedComponent<RNGHFlatListProps<any>>(RNGHFlatList);

const FinalView = AnimatedRNGHFlatList;
type FinalProps<T> = RNGHFlatListProps<T>;
type FinalType<T> = RNGHFlatList<T>;

/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */
const FlatListMemo = React.memo(
  ({
    ref,
    ...props
  }: React.PropsWithChildren<FinalProps<unknown>> & {
    ref?: Ref<FinalType<unknown>>;
  }) => {
    return <FinalView ref={ref} {...props} />;
  },
);

function TabsFlatList<R>({
  contentContainerStyle,
  style,
  onContentSizeChange,
  refreshControl,
  ref,
  ...rest
}: Omit<FinalProps<R>, 'onScroll'> & {
  ref?: Ref<FinalType<R>>;
}): React.ReactElement<any> {
  const name = useTabNameContext();
  const { setRef, contentInset } = useTabsContext();
  const innerRef = useSharedAnimatedRef<FinalType<R>>(ref ?? null);

  const { scrollHandler, enable } = useScrollHandlerY(name);
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet';
    // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things
    enable(true);
  });

  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle();

  React.useEffect(() => {
    setRef(name, innerRef);
  }, [name, innerRef, setRef]);

  const scrollContentSizeChange = useUpdateScrollViewContentSize({
    name,
  });

  const scrollContentSizeChangeHandlers = useChainCallback(
    React.useMemo(
      () => [scrollContentSizeChange, onContentSizeChange],
      [onContentSizeChange, scrollContentSizeChange],
    ),
  );

  const memoRefreshControl = React.useMemo(
    () =>
      refreshControl &&
      React.cloneElement(refreshControl, {
        progressViewOffset,
        ...refreshControl.props,
      }),
    [progressViewOffset, refreshControl],
  );

  const memoContentInset = React.useMemo(
    () => ({ top: contentInset }),
    [contentInset],
  );

  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInset }),
    [contentInset],
  );

  const memoContentContainerStyle = React.useMemo(
    () => [
      _contentContainerStyle,
      // TODO: investigate types
      contentContainerStyle as any,
    ],
    [_contentContainerStyle, contentContainerStyle],
  );
  const memoStyle = React.useMemo(() => [_style, style], [_style, style]);

  return (
    <FlatListMemo
      {...rest}
      onLayout={onLayout}
      // @ts-expect-error - TODO: investigate type issues with ref
      ref={innerRef}
      bouncesZoom={false}
      style={memoStyle}
      contentContainerStyle={memoContentContainerStyle}
      progressViewOffset={progressViewOffset}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
      onMomentumScrollEnd={() => {}}
    />
  );
}

/**
 * Use like a regular FlatList.
 */
export { TabsFlatList };
