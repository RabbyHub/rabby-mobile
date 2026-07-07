"use strict";

const NativeComponentRegistry = require("react-native/Libraries/NativeComponent/NativeComponentRegistry");
const { ConditionallyIgnoredEventHandlers } = require("react-native/Libraries/NativeComponent/ViewConfigIgnore");

const ignoredEventHandlers = ConditionallyIgnoredEventHandlers({
  onPressAction: true,
  onCloseMenu: true,
  onOpenMenu: true
});

const viewConfig = {
  uiViewClassName: "MenuView",
  directEventTypes: {
    topPressAction: {
      registrationName: "onPressAction"
    },
    topCloseMenu: {
      registrationName: "onCloseMenu"
    },
    topOpenMenu: {
      registrationName: "onOpenMenu"
    }
  },
  validAttributes: {
    actions: true,
    actionsHash: true,
    title: true,
    themeVariant: true,
    isAnchoredToRight: true,
    suppressNativeLongPress: true,
    shouldOpenOnLongPress: true,
    hitSlop: true,
    ...(ignoredEventHandlers ?? {})
  }
};

export default NativeComponentRegistry.get("MenuView", () => viewConfig);
