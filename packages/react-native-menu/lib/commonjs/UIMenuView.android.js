"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _reactNative = require("react-native");
var _react = require("react");
var _jsxRuntime = require("react/jsx-runtime");
var _codegenNativeCommands = require("react-native/Libraries/Utilities/codegenNativeCommands");
var _UIMenuViewNativeHost = _interopRequireDefault(require("./UIMenuViewNativeHost"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const codegenNativeCommands = _codegenNativeCommands.default || _codegenNativeCommands;
const Commands = codegenNativeCommands({
  supportedCommands: ["show"]
});
const MenuComponent = /*#__PURE__*/(0, _react.forwardRef)(({
  androidSuppressNativeLongPress = false,
  ...props
}, ref) => {
  const nativeRef = (0, _react.useRef)(null);
  (0, _react.useImperativeHandle)(ref, () => ({
    show: () => {
      if (nativeRef.current) {
        const isFabric = !!global.nativeFabricUIManager;
        if (isFabric) {
          Commands.show(nativeRef.current);
        } else {
          const node = (0, _reactNative.findNodeHandle)(nativeRef.current);
          const command = _reactNative.UIManager.getViewManagerConfig("MenuView").Commands.show;
          _reactNative.UIManager.dispatchViewManagerCommand(node, command, undefined);
        }
      }
    }
  }), []);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_UIMenuViewNativeHost.default, {
    suppressNativeLongPress: androidSuppressNativeLongPress,
    ...props,
    ref: nativeRef
  });
});
var _default = exports.default = MenuComponent;
//# sourceMappingURL=UIMenuView.android.js.map
