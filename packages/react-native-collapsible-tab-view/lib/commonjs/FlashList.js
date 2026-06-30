"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FlashList = void 0;

var _react = _interopRequireWildcard(require("react"));

var _reactNativeReanimated = _interopRequireDefault(require("react-native-reanimated"));

var _hooks = require("./hooks");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

let AnimatedFlashList = null;

const ensureFlastList = () => {
  if (AnimatedFlashList) {
    return;
  }

  try {
    const flashListModule = require('@shopify/flash-list');

    AnimatedFlashList = _reactNativeReanimated.default.createAnimatedComponent(flashListModule.FlashList);
  } catch (error) {
    console.error('The optional dependency @shopify/flash-list is not installed. Please install it to use the FlashList component.');
  }
};

const FlashListMemo = /*#__PURE__*/_react.default.memo( /*#__PURE__*/_react.default.forwardRef((props, passRef) => {
  ensureFlastList();
  return AnimatedFlashList ? /*#__PURE__*/_react.default.createElement(AnimatedFlashList, _extends({
    ref: passRef
  }, props)) : /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null);
}));

function FlashListImpl(_ref, passRef) {
  let {
    style,
    onContentSizeChange,
    refreshControl,
    contentContainerStyle: _contentContainerStyle,
    ...rest
  } = _ref;
  const name = (0, _hooks.useTabNameContext)();
  const {
    setRef,
    contentInset
  } = (0, _hooks.useTabsContext)();
  const ref = (0, _hooks.useSharedAnimatedRef)(passRef);
  const recyclerRef = (0, _hooks.useSharedAnimatedRef)(null);
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
    progressViewOffset,
    contentContainerStyle
  } = (0, _hooks.useCollapsibleStyle)();

  _react.default.useEffect(() => {
    setRef(name, recyclerRef);
  }, [name, recyclerRef, setRef]);

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

  const memoContentContainerStyle = _react.default.useMemo(() => ({
    paddingTop: contentContainerStyle.paddingTop,
    ..._contentContainerStyle
  }), [_contentContainerStyle, contentContainerStyle.paddingTop]);

  const refWorkaround = (0, _react.useCallback)(value => {
    // https://github.com/Shopify/flash-list/blob/2d31530ed447a314ec5429754c7ce88dad8fd087/src/FlashList.tsx#L829
    // We are not accessing the right element or view of the Flashlist (recyclerlistview). So we need to give
    // this ref the access to it
    // eslint-ignore
    ;
    recyclerRef(value === null || value === void 0 ? void 0 : value.recyclerlistview_unsafe);
    ref(value);
  }, [recyclerRef, ref]);
  return (
    /*#__PURE__*/
    // @ts-expect-error typescript complains about `unknown` in the memo, it should be T
    _react.default.createElement(FlashListMemo, _extends({}, rest, {
      onLayout: onLayout,
      ref: refWorkaround,
      contentContainerStyle: memoContentContainerStyle,
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
 * Use like a regular FlashList.
 */


const FlashList = /*#__PURE__*/_react.default.forwardRef(FlashListImpl);

exports.FlashList = FlashList;
//# sourceMappingURL=FlashList.js.map