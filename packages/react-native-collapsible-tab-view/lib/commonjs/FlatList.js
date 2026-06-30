"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FlatList = void 0;

var _react = _interopRequireDefault(require("react"));

var _helpers = require("./helpers");

var _hooks = require("./hooks");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

/**
 * Used as a memo to prevent rerendering too often when the context changes.
 * See: https://github.com/facebook/react/issues/15156#issuecomment-474590693
 */
const FlatListMemo = /*#__PURE__*/_react.default.memo( /*#__PURE__*/_react.default.forwardRef((props, passRef) => {
  return /*#__PURE__*/_react.default.createElement(_helpers.AnimatedFlatList, _extends({
    ref: passRef
  }, props));
}));

function FlatListImpl(_ref, passRef) {
  let {
    contentContainerStyle,
    style,
    onContentSizeChange,
    refreshControl,
    ...rest
  } = _ref;
  const name = (0, _hooks.useTabNameContext)();
  const {
    setRef,
    contentInset
  } = (0, _hooks.useTabsContext)();
  const ref = (0, _hooks.useSharedAnimatedRef)(passRef);
  const {
    scrollHandler,
    enable
  } = (0, _hooks.useScrollHandlerY)(name);
  const onLayout = (0, _hooks.useAfterMountEffect)(rest.onLayout, () => {
    'worklet'; // we enable the scroll event after mounting
    // otherwise we get an `onScroll` call with the initial scroll position which can break things

    enable(true);
  });
  const {
    style: _style,
    contentContainerStyle: _contentContainerStyle,
    progressViewOffset
  } = (0, _hooks.useCollapsibleStyle)();

  _react.default.useEffect(() => {
    setRef(name, ref);
  }, [name, ref, setRef]);

  const scrollContentSizeChange = (0, _hooks.useUpdateScrollViewContentSize)({
    name
  });
  const scrollContentSizeChangeHandlers = (0, _hooks.useChainCallback)(_react.default.useMemo(() => [scrollContentSizeChange, onContentSizeChange], [onContentSizeChange, scrollContentSizeChange]));

  const memoRefreshControl = _react.default.useMemo(() => refreshControl && /*#__PURE__*/_react.default.cloneElement(refreshControl, {
    progressViewOffset,
    ...refreshControl.props
  }), [progressViewOffset, refreshControl]);

  const contentInsetValue = (0, _hooks.useConvertAnimatedToValue)(contentInset);

  const memoContentInset = _react.default.useMemo(() => ({
    top: contentInsetValue
  }), [contentInsetValue]);

  const memoContentOffset = _react.default.useMemo(() => ({
    x: 0,
    y: -contentInsetValue
  }), [contentInsetValue]);

  const memoContentContainerStyle = _react.default.useMemo(() => [_contentContainerStyle, // TODO: investigate types
  contentContainerStyle], [_contentContainerStyle, contentContainerStyle]);

  const memoStyle = _react.default.useMemo(() => [_style, style], [_style, style]);

  return (
    /*#__PURE__*/
    // @ts-expect-error typescript complains about `unknown` in the memo, it should be T
    _react.default.createElement(FlatListMemo, _extends({}, rest, {
      onLayout: onLayout,
      ref: ref,
      bouncesZoom: false,
      style: memoStyle,
      contentContainerStyle: memoContentContainerStyle,
      progressViewOffset: progressViewOffset,
      onScroll: scrollHandler,
      onContentSizeChange: scrollContentSizeChangeHandlers,
      scrollEventThrottle: 16,
      contentInset: memoContentInset,
      contentOffset: memoContentOffset,
      automaticallyAdjustContentInsets: false,
      refreshControl: memoRefreshControl // workaround for: https://github.com/software-mansion/react-native-reanimated/issues/2735
      ,
      onMomentumScrollEnd: () => {}
    }))
  );
}
/**
 * Use like a regular FlatList.
 */


const FlatList = /*#__PURE__*/_react.default.forwardRef(FlatListImpl);

exports.FlatList = FlatList;
//# sourceMappingURL=FlatList.js.map