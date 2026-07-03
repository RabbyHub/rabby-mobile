"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Lazy = void 0;

var _react = _interopRequireWildcard(require("react"));

var _reactNative = require("react-native");

var _reactNativeReanimated = _interopRequireWildcard(require("react-native-reanimated"));

var _ScrollView = require("./ScrollView");

var _hooks = require("./hooks");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/**
 * Typically used internally, but if you want to mix lazy and regular screens you can wrap the lazy ones with this component.
 */
const Lazy = _ref => {
  let {
    children,
    cancelLazyFadeIn,
    startMounted: _startMounted,
    mountDelayMs = 50
  } = _ref;
  const name = (0, _hooks.useTabNameContext)();
  const {
    focusedTab,
    refMap
  } = (0, _hooks.useTabsContext)();
  /**
   * We start mounted if we are the focused tab, or if props.startMounted is true.
   */

  const startMounted = (0, _reactNativeReanimated.useSharedValue)(typeof _startMounted === 'boolean' ? _startMounted : focusedTab.value === name);
  /**
   * We keep track of whether a layout has been triggered
   */

  const didTriggerLayout = (0, _reactNativeReanimated.useSharedValue)(false);
  /**
   * This is used to control when children are mounted
   */

  const [canMount, setCanMount] = _react.default.useState(!!startMounted.value);
  /**
   * Ensure we don't mount after the component has been unmounted
   */


  const isSelfMounted = _react.default.useRef(true);

  const opacity = (0, _reactNativeReanimated.useSharedValue)(cancelLazyFadeIn || startMounted.value ? 1 : 0);

  _react.default.useEffect(() => {
    return () => {
      isSelfMounted.current = false;
    };
  }, []);

  const startMountTimer = _react.default.useCallback(() => {
    // wait the scene to be at least mountDelay ms focused, before mounting
    setTimeout(() => {
      if (focusedTab.value === name) {
        if (isSelfMounted.current) setCanMount(true);
      }
    }, mountDelayMs);
  }, [focusedTab.value, mountDelayMs, name]);

  (0, _reactNativeReanimated.useAnimatedReaction)(() => {
    return focusedTab.value === name;
  }, (focused, wasFocused) => {
    if (focused && !wasFocused && !canMount) {
      if (cancelLazyFadeIn) {
        opacity.value = 1;
        (0, _reactNativeReanimated.runOnJS)(setCanMount)(true);
      } else {
        (0, _reactNativeReanimated.runOnJS)(startMountTimer)();
      }
    }
  }, [canMount, focusedTab]);
  const scrollTo = (0, _hooks.useScroller)();
  const ref = name ? refMap[name] : null;
  (0, _reactNativeReanimated.useAnimatedReaction)(() => {
    return didTriggerLayout.value;
  }, (isMounted, wasMounted) => {
    if (isMounted && !wasMounted) {
      if (!cancelLazyFadeIn && opacity.value !== 1) {
        opacity.value = (0, _reactNativeReanimated.withTiming)(1);
      }
    }
  }, [ref, cancelLazyFadeIn, name, didTriggerLayout, scrollTo]);
  const stylez = (0, _reactNativeReanimated.useAnimatedStyle)(() => {
    return {
      opacity: opacity.value
    };
  }, []);
  const onLayout = (0, _react.useCallback)(() => {
    didTriggerLayout.value = true;
  }, [didTriggerLayout]);
  return canMount ? cancelLazyFadeIn ? children : /*#__PURE__*/_react.default.createElement(_reactNativeReanimated.default.View, {
    pointerEvents: "box-none",
    style: [styles.container, !cancelLazyFadeIn ? stylez : undefined],
    onLayout: onLayout
  }, children) : /*#__PURE__*/_react.default.createElement(_ScrollView.ScrollView, null);
};

exports.Lazy = Lazy;

const styles = _reactNative.StyleSheet.create({
  container: {
    flex: 1
  }
});
//# sourceMappingURL=Lazy.js.map