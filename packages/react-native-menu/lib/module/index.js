"use strict";

import { forwardRef } from "react";
import { processColor } from "react-native";
import UIMenuView from "./UIMenuView";
import { objectHash } from "./utils";
import { jsx as _jsx } from "react/jsx-runtime";
function processAction(action) {
  return {
    ...action,
    imageColor: processColor(action.imageColor),
    titleColor: processColor(action.titleColor),
    subactions: action.subactions?.map(subAction => processAction(subAction))
  };
}
const defaultHitslop = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0
};
const MenuView = /*#__PURE__*/forwardRef(({
  actions,
  hitSlop = defaultHitslop,
  ...props
}, ref) => {
  const processedActions = actions.map(action => processAction(action));
  const hash = objectHash(processedActions);
  return /*#__PURE__*/_jsx(UIMenuView, {
    ...props,
    hitSlop: hitSlop,
    actions: processedActions,
    actionsHash: hash,
    ref: ref
  });
});
export { MenuView };
//# sourceMappingURL=index.js.map
