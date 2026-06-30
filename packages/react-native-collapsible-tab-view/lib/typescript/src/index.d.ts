/// <reference types="react" />
import { Container } from './Container';
import { FlashList } from './FlashList';
import { FlatList } from './FlatList';
import { Lazy } from './Lazy';
import { MasonryFlashList } from './MasonryFlashList';
import { MaterialTabBarProps, MaterialTabItemProps } from './MaterialTabBar';
import { ScrollView } from './ScrollView';
import { SectionList } from './SectionList';
import { Tab } from './Tab';
import { TabBarProps, CollapsibleProps, RefComponent, ContainerRef, CollapsibleRef, OnTabChangeCallback, TabItemProps, TabProps } from './types';
export type { TabBarProps, CollapsibleProps, RefComponent, ContainerRef, MaterialTabBarProps, MaterialTabItemProps, CollapsibleRef, OnTabChangeCallback, TabItemProps, TabProps, };
export declare const Tabs: {
    Container: import("react").MemoExoticComponent<import("react").ForwardRefExoticComponent<CollapsibleProps & import("react").RefAttributes<CollapsibleRef<string>>>>;
    Tab: typeof Tab;
    Lazy: import("react").FC<{
        cancelLazyFadeIn?: boolean | undefined;
        mountDelayMs?: number | undefined;
        startMounted?: boolean | undefined;
        children: import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, any> | null) | (new (props: any) => import("react").Component<any, any, any>)>;
    }>;
    FlatList: <T>(p: import("react-native/types").FlatListProps<T> & {
        ref?: ((instance: import("react-native/types").FlatList<T> | null) => void) | import("react").RefObject<import("react-native/types").FlatList<T> | null> | null | undefined;
    }) => import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, any> | null) | (new (props: any) => import("react").Component<any, any, any>)>;
    ScrollView: import("react").ForwardRefExoticComponent<Pick<import("react-native/types").ScrollViewProps, "scrollEnabled" | "keyboardDismissMode" | "style" | "children" | "onMoveShouldSetResponderCapture" | "onStartShouldSetResponder" | "overScrollMode" | "contentContainerStyle" | "decelerationRate" | "horizontal" | "invertStickyHeaders" | "keyboardShouldPersistTaps" | "onContentSizeChange" | "onScrollBeginDrag" | "onScrollEndDrag" | "onMomentumScrollEnd" | "onMomentumScrollBegin" | "pagingEnabled" | "removeClippedSubviews" | "showsHorizontalScrollIndicator" | "showsVerticalScrollIndicator" | "stickyHeaderHiddenOnScroll" | "refreshControl" | "snapToInterval" | "snapToOffsets" | "snapToStart" | "snapToEnd" | "stickyHeaderIndices" | "disableIntervalMomentum" | "disableScrollViewPanResponder" | "StickyHeaderComponent" | "hitSlop" | "id" | "onLayout" | "pointerEvents" | "testID" | "nativeID" | "collapsable" | "needsOffscreenAlphaCompositing" | "renderToHardwareTextureAndroid" | "focusable" | "shouldRasterizeIOS" | "isTVSelectable" | "hasTVPreferredFocus" | "tvParallaxProperties" | "tvParallaxShiftDistanceX" | "tvParallaxShiftDistanceY" | "tvParallaxTiltAngle" | "tvParallaxMagnification" | "onMoveShouldSetResponder" | "onResponderEnd" | "onResponderGrant" | "onResponderReject" | "onResponderMove" | "onResponderRelease" | "onResponderStart" | "onResponderTerminationRequest" | "onResponderTerminate" | "onStartShouldSetResponderCapture" | "onTouchStart" | "onTouchMove" | "onTouchEnd" | "onTouchCancel" | "onTouchEndCapture" | "onPointerEnter" | "onPointerEnterCapture" | "onPointerLeave" | "onPointerLeaveCapture" | "onPointerMove" | "onPointerMoveCapture" | "onPointerCancel" | "onPointerCancelCapture" | "onPointerDown" | "onPointerDownCapture" | "onPointerUp" | "onPointerUpCapture" | "accessible" | "accessibilityActions" | "accessibilityLabel" | "aria-label" | "accessibilityRole" | "accessibilityState" | "aria-busy" | "aria-checked" | "aria-disabled" | "aria-expanded" | "aria-selected" | "aria-labelledby" | "accessibilityHint" | "accessibilityValue" | "aria-valuemax" | "aria-valuemin" | "aria-valuenow" | "aria-valuetext" | "onAccessibilityAction" | "importantForAccessibility" | "aria-hidden" | "aria-live" | "aria-modal" | "role" | "accessibilityLiveRegion" | "accessibilityLabelledBy" | "accessibilityElementsHidden" | "accessibilityViewIsModal" | "onAccessibilityEscape" | "onAccessibilityTap" | "onMagicTap" | "accessibilityIgnoresInvertColors" | "accessibilityLanguage" | "alwaysBounceHorizontal" | "alwaysBounceVertical" | "automaticallyAdjustContentInsets" | "automaticallyAdjustKeyboardInsets" | "automaticallyAdjustsScrollIndicatorInsets" | "bounces" | "bouncesZoom" | "canCancelContentTouches" | "centerContent" | "contentInset" | "contentOffset" | "contentInsetAdjustmentBehavior" | "directionalLockEnabled" | "indicatorStyle" | "maintainVisibleContentPosition" | "maximumZoomScale" | "minimumZoomScale" | "onScrollAnimationEnd" | "pinchGestureEnabled" | "scrollEventThrottle" | "scrollIndicatorInsets" | "scrollToOverflowEnabled" | "scrollsToTop" | "snapToAlignment" | "onScrollToTop" | "zoomScale" | "endFillColor" | "scrollPerfTag" | "nestedScrollEnabled" | "fadingEdgeLength" | "persistentScrollbar"> & {
        children?: import("react").ReactNode;
    } & import("react").RefAttributes<import("react-native/types").ScrollView>>;
    SectionList: <T_1>(p: import("react-native/types").SectionListProps<T_1, import("react-native/types").DefaultSectionT> & {
        ref?: ((instance: import("react-native/types").SectionList<T_1, import("react-native/types").DefaultSectionT> | null) => void) | import("react").RefObject<import("react-native/types").SectionList<T_1, import("react-native/types").DefaultSectionT> | null> | null | undefined;
    }) => import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, any> | null) | (new (props: any) => import("react").Component<any, any, any>)>;
    FlashList: <T_2>(p: import("@shopify/flash-list").FlashListProps<T_2> & {
        ref?: ((instance: import("@shopify/flash-list/dist/FlashList").default<T_2> | null) => void) | import("react").RefObject<import("@shopify/flash-list/dist/FlashList").default<T_2> | null> | null | undefined;
    }) => import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, any> | null) | (new (props: any) => import("react").Component<any, any, any>)>;
    MasonryFlashList: <T_3>(p: import("@shopify/flash-list").MasonryFlashListProps<T_3> & {
        ref?: ((instance: import("@shopify/flash-list").MasonryFlashListRef<any> | null) => void) | import("react").RefObject<import("@shopify/flash-list").MasonryFlashListRef<any> | null> | null | undefined;
    }) => import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, any> | null) | (new (props: any) => import("react").Component<any, any, any>)>;
};
export { Container, Tab, Lazy, FlatList, ScrollView, SectionList, FlashList, MasonryFlashList, };
export { useCurrentTabScrollY, useHeaderMeasurements, useFocusedTab, useAnimatedTabIndex, useCollapsibleStyle, } from './hooks';
export type { HeaderMeasurements } from './hooks';
export { MaterialTabBar } from './MaterialTabBar/TabBar';
export { MaterialTabItem } from './MaterialTabBar/TabItem';
