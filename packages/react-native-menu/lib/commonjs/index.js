"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MenuView = void 0;
var _react = require("react");
var _reactNative = require("react-native");
var _UIMenuView = _interopRequireDefault(require("./UIMenuView"));
var _utils = require("./utils");
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function processAction(action) {
  return {
    ...action,
    imageColor: (0, _reactNative.processColor)(action.imageColor),
    titleColor: (0, _reactNative.processColor)(action.titleColor),
    subactions: action.subactions?.map(subAction => processAction(subAction))
  };
}
const defaultHitslop = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0
};
const MenuView = exports.MenuView = /*#__PURE__*/(0, _react.forwardRef)(({
  actions,
  hitSlop = defaultHitslop,
  ...props
}, ref) => {
  const processedActions = actions.map(action => processAction(action));
  const hash = (0, _utils.objectHash)(processedActions);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_UIMenuView.default, {
    ...props,
    hitSlop: hitSlop,
    actions: processedActions,
    actionsHash: hash,
    ref: ref
  });
});
//# sourceMappingURL=index.js.map
