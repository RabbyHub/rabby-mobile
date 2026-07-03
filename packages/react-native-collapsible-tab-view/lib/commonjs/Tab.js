"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tab = Tab;

var _react = _interopRequireDefault(require("react"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Wrap your screens with `Tabs.Tab`. Basic usage looks like this:
 *
 * ```tsx
 * <Tabs.Container ...>
 *  <Tabs.Tab name="A" label="First Tab">
 *   <ScreenA />
 *  </Tabs.Tab>
 *  <Tabs.Tab name="B">
 *   <ScreenA />
 *  </Tabs.Tab>
 * </Tabs.Container>
 * ```
 */
function Tab(_ref) {
  let {
    children
  } = _ref;
  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, children);
}
//# sourceMappingURL=Tab.js.map