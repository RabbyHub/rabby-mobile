function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import React, { useCallback } from 'react';
import Animated from 'react-native-reanimated';
import { useAfterMountEffect, useChainCallback, useCollapsibleStyle, useConvertAnimatedToValue, useScrollHandlerY, useSharedAnimatedRef, useTabNameContext, useTabsContext, useUpdateScrollViewContentSize } from './hooks';
/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */

let AnimatedMasonry = null;

const ensureMasonry = () => {
  if (AnimatedMasonry) {
    return;
  }

  try {
    const flashListModule = require('@shopify/flash-list');

    AnimatedMasonry = Animated.createAnimatedComponent(flashListModule.MasonryFlashList);
  } catch (error) {
    console.error('The optional dependency @shopify/flash-list is not installed. Please install it to use the FlashList component.');
  }
};

const MasonryFlashListMemo = /*#__PURE__*/React.memo( /*#__PURE__*/React.forwardRef((props, passRef) => {
  ensureMasonry();
  return AnimatedMasonry ?
  /*#__PURE__*/
  // @ts-expect-error
  React.createElement(AnimatedMasonry, _extends({
    ref: passRef
  }, props)) : /*#__PURE__*/React.createElement(React.Fragment, null);
}));

function MasonryFlashListImpl(_ref, passRef) {
  let {
    style,
    onContentSizeChange,
    contentContainerStyle: _contentContainerStyle,
    refreshControl,
    ...rest
  } = _ref;
  const name = useTabNameContext();
  const {
    setRef,
    contentInset
  } = useTabsContext();
  const recyclerRef = useSharedAnimatedRef(null);
  const ref = useSharedAnimatedRef(passRef);
  const {
    scrollHandler,
    enable
  } = useScrollHandlerY(name);
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet'; // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things

    enable(true);
  });
  const {
    progressViewOffset,
    contentContainerStyle
  } = useCollapsibleStyle();
  React.useEffect(() => {
    setRef(name, recyclerRef);
  }, [name, recyclerRef, setRef]);
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
  const memoContentContainerStyle = React.useMemo(() => ({
    paddingTop: contentContainerStyle.paddingTop,
    ..._contentContainerStyle
  }), [_contentContainerStyle, contentContainerStyle.paddingTop]);
  const refWorkaround = useCallback(value => {
    // https://github.com/Shopify/flash-list/blob/2d31530ed447a314ec5429754c7ce88dad8fd087/src/FlashList.tsx#L829
    // We are not accessing the right element or view of the Flashlist (recyclerlistview). So we need to give
    // this ref the access to it
    // @ts-expect-error
    ;
    recyclerRef(value === null || value === void 0 ? void 0 : value.recyclerlistview_unsafe);
    ref(value);
  }, [recyclerRef, ref]);
  return (
    /*#__PURE__*/
    // @ts-expect-error typescript complains about `unknown` in the memo, it should be T
    React.createElement(MasonryFlashListMemo, _extends({}, rest, {
      onLayout: onLayout,
      contentContainerStyle: memoContentContainerStyle,
      ref: refWorkaround,
      bouncesZoom: false,
      onScroll: scrollHandler,
      scrollEventThrottle: 16,
      contentInset: memoContentInset,
      contentOffset: memoContentOffset,
      refreshControl: memoRefreshControl,
      progressViewOffset: progressViewOffset,
      automaticallyAdjustContentInsets: false,
      onContentSizeChange: scrollContentSizeChangeHandlers
    }))
  );
}
/**
 * Use like a regular MasonryFlashList.
 */


export const MasonryFlashList = /*#__PURE__*/React.forwardRef(MasonryFlashListImpl);
//# sourceMappingURL=MasonryFlashList.js.map