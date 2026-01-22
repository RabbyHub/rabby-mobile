// patch from file:///./../../../../node_modules/react-native-collapsible-tab-view/src/ScrollView.tsx

import React from 'react';
import Animated from 'react-native-reanimated';
import { ScrollView as RNGHScrollView } from 'react-native-gesture-handler';

import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useConvertAnimatedToValue,
  // useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from 'react-native-collapsible-tab-view/src/hooks';
import { ScrollHandlerProps, useScrollHandlerY } from './hooks';

type RNGHScrollViewProps = React.ComponentProps<typeof RNGHScrollView>;

const AnimatedRNGHScrollView =
  Animated.createAnimatedComponent<RNGHScrollViewProps>(RNGHScrollView);

/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */
const ScrollViewMemo = React.memo(
  React.forwardRef<
    RNGHScrollView,
    React.PropsWithChildren<RNGHScrollViewProps>
  >((props, passRef) => {
    return <AnimatedRNGHScrollView ref={passRef} {...props} />;
  }),
);

export type TabsScrollViewProps = React.PropsWithChildren<
  Omit<RNGHScrollViewProps, 'onScroll'>
> &
  ScrollHandlerProps;

/**
 * Use like a regular ScrollView.
 */
export const TabsScrollView = React.forwardRef<
  RNGHScrollView,
  TabsScrollViewProps
>(
  (
    {
      contentContainerStyle,
      style,
      onContentSizeChange,
      children,
      refreshControl,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onScrollMomentumBegin,
      onScrollMomentumEnd,
      scrollableEnabled,
      ...rest
    },
    passRef,
  ) => {
    const name = useTabNameContext();
    const ref = useSharedAnimatedRef<RNGHScrollView>(passRef);
    const { setRef, contentInset } = useTabsContext();
    const {
      style: _style,
      contentContainerStyle: _contentContainerStyle,
      progressViewOffset,
    } = useCollapsibleStyle();
    const { scrollHandler, enable } = useScrollHandlerY(name, {
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onScrollMomentumBegin,
      onScrollMomentumEnd,
      scrollableEnabled,
    });
    const onLayout = useAfterMountEffect(rest.onLayout, () => {
      'worklet';
      // we enable the scroll event after mounting
      // otherwise we get an `onScroll` call with the initial scroll position which can break things
      enable(true);
    });

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
      <ScrollViewMemo
        {...rest}
        onLayout={onLayout}
        ref={ref}
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
  },
);
