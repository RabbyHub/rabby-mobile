"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TABBAR_HEIGHT = exports.MaterialTabBar = void 0;

var _react = _interopRequireDefault(require("react"));

var _reactNative = require("react-native");

var _reactNativeReanimated = _interopRequireWildcard(require("react-native-reanimated"));

var _Indicator = require("./Indicator");

var _TabItem = require("./TabItem");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TABBAR_HEIGHT = 48;
/**
 * Basic usage looks like this:
 *
 * ```tsx
 * <Tabs.Container
 *   ...
 *   TabBarComponent={(props) => (
 *     <MaterialTabBar
 *       {...props}
 *       activeColor="red"
 *       inactiveColor="yellow"
 *       inactiveOpacity={1}
 *       labelStyle={{ fontSize: 14 }}
 *     />
 *   )}
 * >
 *   {...}
 * </Tabs.Container>
 * ```
 */

exports.TABBAR_HEIGHT = TABBAR_HEIGHT;

const MaterialTabBar = _ref => {
  let {
    tabNames,
    indexDecimal,
    scrollEnabled = false,
    indicatorStyle,
    index,
    TabItemComponent = _TabItem.MaterialTabItem,
    getLabelText = name => String(name).toUpperCase(),
    onTabPress,
    style,
    tabProps,
    contentContainerStyle,
    labelStyle,
    inactiveColor,
    activeColor,
    tabStyle,
    width: customWidth,
    keepActiveTabCentered
  } = _ref;
  const tabBarRef = (0, _reactNativeReanimated.useAnimatedRef)();
  const windowWidth = (0, _reactNative.useWindowDimensions)().width;
  const width = customWidth !== null && customWidth !== void 0 ? customWidth : windowWidth;

  const isFirstRender = _react.default.useRef(true);

  const itemLayoutGathering = _react.default.useRef(new Map());

  const tabsOffset = (0, _reactNativeReanimated.useSharedValue)(0);
  const isScrolling = (0, _reactNativeReanimated.useSharedValue)(false);
  const nTabs = tabNames.length;

  const [itemsLayout, setItemsLayout] = _react.default.useState(scrollEnabled ? [] : tabNames.map((_, i) => {
    const tabWidth = width / nTabs;
    return {
      width: tabWidth,
      x: i * tabWidth
    };
  }));

  _react.default.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else if (!scrollEnabled) {
      // update items width on window resizing
      const tabWidth = width / nTabs;
      setItemsLayout(tabNames.map((_, i) => {
        return {
          width: tabWidth,
          x: i * tabWidth
        };
      }));
    }
  }, [scrollEnabled, nTabs, tabNames, width]);

  const onTabItemLayout = _react.default.useCallback((event, name) => {
    if (scrollEnabled) {
      var _event$nativeEvent;

      if (!((_event$nativeEvent = event.nativeEvent) !== null && _event$nativeEvent !== void 0 && _event$nativeEvent.layout)) return;
      const {
        width,
        x
      } = event.nativeEvent.layout;
      itemLayoutGathering.current.set(name, {
        width,
        x
      }); // pick out the layouts for the tabs we know about (in case they changed dynamically)

      const layout = Array.from(itemLayoutGathering.current.entries()).filter(_ref2 => {
        let [tabName] = _ref2;
        return tabNames.includes(tabName);
      }).map(_ref3 => {
        let [, layout] = _ref3;
        return layout;
      }).sort((a, b) => a.x - b.x);

      if (layout.length === tabNames.length) {
        setItemsLayout(layout);
      }
    }
  }, [scrollEnabled, tabNames]);

  const cancelNextScrollSync = (0, _reactNativeReanimated.useSharedValue)(index.value);
  const onScroll = (0, _reactNativeReanimated.useAnimatedScrollHandler)({
    onScroll: event => {
      tabsOffset.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      isScrolling.value = true;
      cancelNextScrollSync.value = index.value;
    },
    onMomentumEnd: () => {
      isScrolling.value = false;
    }
  }, []);
  const currentIndexToSync = (0, _reactNativeReanimated.useSharedValue)(index.value);
  const targetIndexToSync = (0, _reactNativeReanimated.useSharedValue)(index.value);
  (0, _reactNativeReanimated.useAnimatedReaction)(() => {
    return index.value;
  }, nextIndex => {
    if (scrollEnabled) {
      (0, _reactNativeReanimated.cancelAnimation)(currentIndexToSync);
      targetIndexToSync.value = nextIndex;
      currentIndexToSync.value = (0, _reactNativeReanimated.withTiming)(nextIndex);
    }
  }, [scrollEnabled]);
  (0, _reactNativeReanimated.useAnimatedReaction)(() => {
    return currentIndexToSync.value === targetIndexToSync.value;
  }, canSync => {
    if (canSync && scrollEnabled && itemsLayout.length === nTabs && itemsLayout[index.value]) {
      const halfTab = itemsLayout[index.value].width / 2;
      const offset = itemsLayout[index.value].x;

      if (keepActiveTabCentered || offset < tabsOffset.value || offset > tabsOffset.value + width - 2 * halfTab) {
        (0, _reactNativeReanimated.scrollTo)(tabBarRef, offset - width / 2 + halfTab, 0, true);
      }
    }
  }, [scrollEnabled, itemsLayout, nTabs]);
  return /*#__PURE__*/_react.default.createElement(_reactNativeReanimated.default.ScrollView, {
    ref: tabBarRef,
    horizontal: true,
    style: style,
    contentContainerStyle: [styles.contentContainer, !scrollEnabled && {
      width
    }, contentContainerStyle],
    keyboardShouldPersistTaps: "handled",
    bounces: false,
    alwaysBounceHorizontal: false,
    scrollsToTop: false,
    showsHorizontalScrollIndicator: false,
    automaticallyAdjustContentInsets: false,
    overScrollMode: "never",
    scrollEnabled: scrollEnabled,
    onScroll: scrollEnabled ? onScroll : undefined,
    scrollEventThrottle: 16
  }, tabNames.map((name, i) => {
    var _tabProps$get;

    return /*#__PURE__*/_react.default.createElement(TabItemComponent, {
      key: name,
      index: i,
      name: name,
      label: ((_tabProps$get = tabProps.get(name)) === null || _tabProps$get === void 0 ? void 0 : _tabProps$get.label) || getLabelText(name),
      onPress: onTabPress,
      onLayout: scrollEnabled ? event => onTabItemLayout(event, name) : undefined,
      scrollEnabled: scrollEnabled,
      indexDecimal: indexDecimal,
      labelStyle: labelStyle,
      activeColor: activeColor,
      inactiveColor: inactiveColor,
      style: tabStyle
    });
  }), itemsLayout.length === nTabs && /*#__PURE__*/_react.default.createElement(_Indicator.Indicator, {
    indexDecimal: indexDecimal,
    itemsLayout: itemsLayout,
    fadeIn: scrollEnabled,
    style: indicatorStyle
  }));
};

const MemoizedTabBar = /*#__PURE__*/_react.default.memo(MaterialTabBar);

exports.MaterialTabBar = MemoizedTabBar;

const styles = _reactNative.StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap'
  }
});
//# sourceMappingURL=TabBar.js.map