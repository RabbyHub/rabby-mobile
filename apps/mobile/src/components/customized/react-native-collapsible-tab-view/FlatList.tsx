// patch from file:///./../../../../node_modules/react-native-collapsible-tab-view/src/FlatList.tsx

import React from 'react';
import {
  FlatListProps as RNFlatListProps,
  FlatList as RNFlatList,
} from 'react-native';
import Animated from 'react-native-reanimated';

import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useConvertAnimatedToValue,
  useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from 'react-native-collapsible-tab-view/src/hooks';
import { RNGHFlatList } from '../reexports';

// const AnimatedScrollView = Animated.createAnimatedComponent<RNFlatListProps>(RNFlatList);
// const FinalView = AnimatedScrollView;
// type FinalProps = RNFlatListProps;
// type FinalType = RNFlatList;

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
  React.forwardRef<
    FinalType<unknown>,
    React.PropsWithChildren<FinalProps<unknown>>
  >((props, passRef) => {
    return <FinalView ref={passRef} {...props} />;
  }),
);

function FlatListImpl<R>(
  {
    contentContainerStyle,
    style,
    onContentSizeChange,
    refreshControl,
    ...rest
  }: Omit<FinalProps<R>, 'onScroll'>,
  passRef: React.Ref<FinalType<R>>,
): React.ReactElement {
  const name = useTabNameContext();
  const { setRef, contentInset } = useTabsContext();
  const ref = useSharedAnimatedRef<FinalType<R>>(passRef);

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
    setRef(name, ref);
  }, [name, ref, setRef]);

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

  const contentInsetValue = useConvertAnimatedToValue(contentInset);

  const memoContentInset = React.useMemo(
    () => ({ top: contentInsetValue }),
    [contentInsetValue],
  );

  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInsetValue }),
    [contentInsetValue],
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
      ref={ref}
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
export const TabsFlatList = React.forwardRef(FlatListImpl) as <T>(
  p: FinalProps<T> & { ref?: React.Ref<FinalType<T>> },
) => React.ReactElement;
