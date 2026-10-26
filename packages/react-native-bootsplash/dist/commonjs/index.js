"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.hide = hide;
exports.isVisible = isVisible;
exports.useHideAnimation = useHideAnimation;
var _react = require("react");
var _reactNative = require("react-native");
var _reactNativeIsEdgeToEdge = require("react-native-is-edge-to-edge");
var _NativeRNBootSplash = _interopRequireDefault(require("./specs/NativeRNBootSplash"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const EDGE_TO_EDGE = (0, _reactNativeIsEdgeToEdge.isEdgeToEdge)();
function hide(config = {}) {
  const {
    fade = false
  } = config;
  return _NativeRNBootSplash.default.hide(fade).then(() => {});
}
function isVisible() {
  return _NativeRNBootSplash.default.isVisible();
}
function useHideAnimation(config) {
  const {
    manifest,
    ready = true,
    logo: logoSrc,
    darkLogo: darkLogoSrc,
    brand: brandSrc,
    darkBrand: darkBrandSrc,
    animate,
    statusBarTranslucent,
    navigationBarTranslucent
  } = config;

  // __DEV__ global is missing in react-native-web
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    (0, _reactNativeIsEdgeToEdge.controlEdgeToEdgeValues)({
      statusBarTranslucent,
      navigationBarTranslucent
    });
  }
  const skipLogo = logoSrc == null;
  const skipBrand = manifest.brand == null || brandSrc == null;
  const logoWidth = manifest.logo.width;
  const logoHeight = manifest.logo.height;
  const brandBottom = manifest.brand?.bottom;
  const brandWidth = manifest.brand?.width;
  const brandHeight = manifest.brand?.height;
  const [{
    darkModeEnabled,
    logoSizeRatio = 1,
    navigationBarHeight = 0,
    statusBarHeight = 0
  }] = (0, _react.useState)(() => _NativeRNBootSplash.default.getConstants());
  const backgroundColor = darkModeEnabled && manifest.darkBackground != null ? manifest.darkBackground : manifest.background;
  const logoFinalSrc = skipLogo ? undefined : darkModeEnabled && darkLogoSrc != null ? darkLogoSrc : logoSrc;
  const brandFinalSrc = skipBrand ? undefined : darkModeEnabled && darkBrandSrc != null ? darkBrandSrc : brandSrc;
  const ref = (0, _react.useRef)({
    layoutReady: false,
    logoReady: skipLogo,
    brandReady: skipBrand,
    userReady: ready,
    animate,
    animateHasBeenCalled: false
  });
  const maybeRunAnimate = (0, _react.useCallback)(() => {
    if (ref.current.layoutReady && ref.current.logoReady && ref.current.brandReady && ref.current.userReady && !ref.current.animateHasBeenCalled) {
      ref.current.animateHasBeenCalled = true;
      hide({
        fade: false
      }).then(() => ref.current.animate()).catch(() => {});
    }
  }, []);
  (0, _react.useEffect)(() => {
    ref.current.animate = animate;
    ref.current.userReady = ready;
    maybeRunAnimate();
  });
  return (0, _react.useMemo)(() => {
    const containerStyle = {
      alignItems: "center",
      backgroundColor,
      justifyContent: "center",
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };
    const container = {
      style: containerStyle,
      onLayout: () => {
        ref.current.layoutReady = true;
        maybeRunAnimate();
      }
    };
    const logo = logoFinalSrc == null ? {
      source: -1
    } : {
      source: logoFinalSrc,
      fadeDuration: 0,
      resizeMode: "contain",
      style: {
        width: logoWidth,
        height: logoHeight
      },
      onLoadEnd: () => {
        ref.current.logoReady = true;
        maybeRunAnimate();
      }
    };
    const brand = brandFinalSrc == null ? {
      source: -1
    } : {
      source: brandFinalSrc,
      fadeDuration: 0,
      resizeMode: "contain",
      style: {
        position: "absolute",
        bottom: _reactNative.Platform.OS === "web" ? 60 : brandBottom,
        width: brandWidth,
        height: brandHeight
      },
      onLoadEnd: () => {
        ref.current.brandReady = true;
        maybeRunAnimate();
      }
    };
    if (_reactNative.Platform.OS !== "android") {
      return {
        container,
        logo,
        brand
      };
    }
    return {
      container: {
        ...container,
        style: {
          ...containerStyle,
          marginTop: EDGE_TO_EDGE || (statusBarTranslucent ?? false) ? undefined : -statusBarHeight,
          marginBottom: EDGE_TO_EDGE || (navigationBarTranslucent ?? false) ? undefined : -navigationBarHeight
        }
      },
      logo: {
        ...logo,
        style: {
          width: logoWidth * logoSizeRatio,
          height: logoHeight * logoSizeRatio
        }
      },
      brand
    };
  }, [logoSizeRatio, navigationBarHeight, statusBarHeight, maybeRunAnimate, logoWidth, logoHeight, brandBottom, brandWidth, brandHeight, backgroundColor, logoFinalSrc, brandFinalSrc, statusBarTranslucent, navigationBarTranslucent]);
}
var _default = exports.default = {
  hide,
  isVisible,
  useHideAnimation
};
//# sourceMappingURL=index.js.map