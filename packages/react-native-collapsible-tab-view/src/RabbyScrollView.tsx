import React, { type Ref } from 'react';
import Animated from 'react-native-reanimated';
import { ScrollView as RNGHScrollView } from 'react-native-gesture-handler';

import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useConvertAnimatedToValue,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from './hooks';
import { ScrollHandlerProps, useScrollHandlerY } from './RabbyHooks';

type RNGHScrollViewProps = React.ComponentProps<typeof RNGHScrollView>;
const AnimatedRNGHScrollView =
  Animated.createAnimatedComponent<RNGHScrollViewProps>(RNGHScrollView);

const FinalScrollView = AnimatedRNGHScrollView;
type FinalScrollViewProps = RNGHScrollViewProps;
type FinalScrolViewType = RNGHScrollView;

/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */
const ScrollViewMemo = React.memo(
  ({
    ref,
    ...props
  }: React.PropsWithChildren<FinalScrollViewProps> & {
    ref?: Ref<FinalScrolViewType>;
  }) => {
    return <FinalScrollView ref={ref} {...props} />;
  },
);

export type RabbyScrollViewProps = React.PropsWithChildren<
  Omit<FinalScrollViewProps, 'onScroll'>
> &
  ScrollHandlerProps & { ref?: Ref<FinalScrolViewType> };

/**
 * Use like a regular ScrollView.
 */
export function RabbyScrollView({
  contentContainerStyle,
  style,
  onContentSizeChange,
  children,
  refreshControl,
  onScroll,
  onAnimatedScrollBeginDrag,
  onAnimatedScrollEndDrag,
  onAnimatedScrollMomentumBegin,
  onAnimatedScrollMomentumEnd,
  scrollableEnabled,
  ref,
  ...rest
}: RabbyScrollViewProps) {
  const name = useTabNameContext();
  const innerRef = useSharedAnimatedRef<FinalScrolViewType>(ref ?? null);
  const { setRef, contentInset } = useTabsContext();
  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle();
  const { scrollHandler, enable } = useScrollHandlerY(name, {
    onScroll,
    onAnimatedScrollBeginDrag,
    onAnimatedScrollEndDrag,
    onAnimatedScrollMomentumBegin,
    onAnimatedScrollMomentumEnd,
    scrollableEnabled,
  });
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet';
    // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things
    enable(true);
  });

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
    <ScrollViewMemo
      {...rest}
      onLayout={onLayout}
      ref={innerRef}
      bouncesZoom={false}
      style={memoStyle}
      contentContainerStyle={memoContentContainerStyle}
      onScroll={scrollHandler}
      onContentSizeChange={scrollContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
      onMomentumScrollEnd={() => {}}>
      {children}
    </ScrollViewMemo>
  );
}
