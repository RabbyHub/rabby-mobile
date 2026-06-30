"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TABBAR_HEIGHT = exports.MaterialTabItem = void 0;

var _react = _interopRequireWildcard(require("react"));

var _reactNative = require("react-native");

var _reactNativeReanimated = _interopRequireWildcard(require("react-native-reanimated"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const TABBAR_HEIGHT = 48;
exports.TABBAR_HEIGHT = TABBAR_HEIGHT;
const DEFAULT_COLOR = 'rgba(0, 0, 0, 1)';
/**
 * Any additional props are passed to the pressable component.
 */

const MaterialTabItem = props => {
  const {
    name,
    index,
    onPress,
    onLayout,
    scrollEnabled,
    indexDecimal,
    label,
    style,
    labelStyle,
    activeColor = DEFAULT_COLOR,
    inactiveColor = DEFAULT_COLOR,
    inactiveOpacity = 0.7,
    pressColor = '#DDDDDD',
    pressOpacity = _reactNative.Platform.OS === 'ios' ? 0.2 : 1,
    ...rest
  } = props;
  const stylez = (0, _reactNativeReanimated.useAnimatedStyle)(() => {
    return {
      opacity: (0, _reactNativeReanimated.interpolate)(indexDecimal.value, [index - 1, index, index + 1], [inactiveOpacity, 1, inactiveOpacity], _reactNativeReanimated.Extrapolation.CLAMP),
      color: Math.abs(index - indexDecimal.value) < 0.5 ? activeColor : inactiveColor
    };
  });
  const renderedLabel = (0, _react.useMemo)(() => {
    if (typeof label === 'string') {
      return /*#__PURE__*/_react.default.createElement(_reactNativeReanimated.default.Text, {
        style: [styles.label, stylez, labelStyle]
      }, label);
    }

    return label(props);
  }, [label, labelStyle, props, stylez]);
  return /*#__PURE__*/_react.default.createElement(_reactNative.Pressable, _extends({
    onLayout: onLayout,
    style: _ref => {
      let {
        pressed
      } = _ref;
      return [{
        opacity: pressed ? pressOpacity : 1
      }, !scrollEnabled && styles.grow, styles.item, style];
    },
    onPress: () => onPress(name),
    android_ripple: {
      borderless: true,
      color: pressColor
    }
  }, rest), renderedLabel);
};

exports.MaterialTabItem = MaterialTabItem;

const styles = _reactNative.StyleSheet.create({
  grow: {
    flex: 1
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: TABBAR_HEIGHT
  },
  label: {
    margin: 4
  }
});
//# sourceMappingURL=TabItem.js.map