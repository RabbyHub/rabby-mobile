function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import React from 'react';
import Animated from 'react-native-reanimated';
import { useAfterMountEffect, useChainCallback, useCollapsibleStyle, useConvertAnimatedToValue, useScrollHandlerY, useSharedAnimatedRef, useTabNameContext, useTabsContext, useUpdateScrollViewContentSize } from './hooks';
/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */

const ScrollViewMemo = /*#__PURE__*/React.memo( /*#__PURE__*/React.forwardRef((props, passRef) => {
  return /*#__PURE__*/React.createElement(Animated.ScrollView, _extends({
    // @ts-expect-error reanimated types are broken on ref
    ref: passRef
  }, props));
}));
/**
 * Use like a regular ScrollView.
 */

export const ScrollView = /*#__PURE__*/React.forwardRef((_ref, passRef) => {
  let {
    contentContainerStyle,
    style,
    onContentSizeChange,
    children,
    refreshControl,
    ...rest
  } = _ref;
  const name = useTabNameContext();
  const ref = useSharedAnimatedRef(passRef);
  const {
    setRef,
    contentInset
  } = useTabsContext();
  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset
  } = useCollapsibleStyle();
  const {
    scrollHandler,
    enable
  } = useScrollHandlerY(name);
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet'; // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things

    enable(true);
  });
  React.useEffect(() => {
    setRef(name, ref);
  }, [name, ref, setRef]);
  const scrollContentSizeChange = useUpdateScrollViewContentSize({
    name
  });
  const scrollContentSizeChangeHandlers = useChainCallback(React.useMemo(() => [scrollContentSizeChange, onContentSizeChange], [onContentSizeChange, scrollContentSizeChange]));
  const memoRefreshControl = React.useMemo(() => refreshControl && /*#__PURE__*/React.cloneElement(refreshControl, {
    progressViewOffset,
    ...refreshControl.props
  }), [progressViewOffset, refreshControl]);
  const contentInsetValue = useConvertAnimatedToValue(contentInset);
  const memoContentInset = React.useMemo(() => ({
    top: contentInsetValue
  }), [contentInsetValue]);
  const memoContentOffset = React.useMemo(() => ({
    x: 0,
    y: -contentInsetValue
  }), [contentInsetValue]);
  const memoContentContainerStyle = React.useMemo(() => [_contentContainerStyle, // TODO: investigate types
  contentContainerStyle], [_contentContainerStyle, contentContainerStyle]);
  const memoStyle = React.useMemo(() => [_style, style], [_style, style]);
  return /*#__PURE__*/React.createElement(ScrollViewMemo, _extends({}, rest, {
    onLayout: onLayout,
    ref: ref,
    bouncesZoom: false,
    style: memoStyle,
    contentContainerStyle: memoContentContainerStyle,
    onScroll: scrollHandler,
    onContentSizeChange: scrollContentSizeChangeHandlers,
    scrollEventThrottle: 16,
    contentInset: memoContentInset,
    contentOffset: memoContentOffset,
    automaticallyAdjustContentInsets: false,
    refreshControl: memoRefreshControl // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
    ,
    onMomentumScrollEnd: () => {}
  }), children);
});
//# sourceMappingURL=ScrollView.js.map