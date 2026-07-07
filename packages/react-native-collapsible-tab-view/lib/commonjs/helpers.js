"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isRTL = exports.ONE_FRAME_MS = exports.IS_IOS = exports.AnimatedSectionList = exports.AnimatedFlatList = void 0;
exports.scrollToImpl = scrollToImpl;

var _reactNative = require("react-native");

var _reactNativeReanimated = _interopRequireWildcard(require("react-native-reanimated"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/** The time one frame takes at 60 fps (16 ms) */
const ONE_FRAME_MS = 16;
/** check if app is in RTL mode or not */

exports.ONE_FRAME_MS = ONE_FRAME_MS;
const {
  isRTL
} = _reactNative.I18nManager;
exports.isRTL = isRTL;
const IS_IOS = _reactNative.Platform.OS === 'ios';
exports.IS_IOS = IS_IOS;

const AnimatedFlatList = _reactNativeReanimated.default.createAnimatedComponent(_reactNative.FlatList);

exports.AnimatedFlatList = AnimatedFlatList;

const AnimatedSectionList = _reactNativeReanimated.default.createAnimatedComponent(_reactNative.SectionList);

exports.AnimatedSectionList = AnimatedSectionList;

function scrollToImpl(ref, x, y, animated) {
  'worklet';

  if (!ref) return; // ensure we don't scroll on NaN

  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  (0, _reactNativeReanimated.scrollTo)(ref, x, y, animated);
}
//# sourceMappingURL=helpers.js.map