"use strict";

import { findNodeHandle, UIManager } from "react-native";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { jsx as _jsx } from "react/jsx-runtime";
import codegenNativeCommands from "react-native/Libraries/Utilities/codegenNativeCommands";
import NativeMenuComponent from "./UIMenuViewNativeHost";
const Commands = codegenNativeCommands({
  supportedCommands: ["show"]
});
const MenuComponent = /*#__PURE__*/forwardRef(({
  androidSuppressNativeLongPress = false,
  ...props
}, ref) => {
  const nativeRef = useRef(null);
  useImperativeHandle(ref, () => ({
    show: () => {
      if (nativeRef.current) {
        const isFabric = !!global.nativeFabricUIManager;
        if (isFabric) {
          Commands.show(nativeRef.current);
        } else {
          const node = findNodeHandle(nativeRef.current);
          const command = UIManager.getViewManagerConfig("MenuView").Commands.show;
          UIManager.dispatchViewManagerCommand(node, command, undefined);
        }
      }
    }
  }), []);
  return /*#__PURE__*/_jsx(NativeMenuComponent, {
    suppressNativeLongPress: androidSuppressNativeLongPress,
    ...props,
    ref: nativeRef
  });
});
export default MenuComponent;
//# sourceMappingURL=UIMenuView.android.js.map
