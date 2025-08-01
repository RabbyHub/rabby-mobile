import {
  EXTRA_MIN_MARGIN,
  EXTRA_WEBVIEW_HEIGHT,
  GROW_WEBVIEW_THRESHOLD,
  SHRINK_WEBVIEW_THRESHOLD,
  WEBVIEW_HEIGHT,
} from '@/constant/browser';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useMemoizedFn } from 'ahooks';
import { useRef } from 'react';
import { Dimensions, NativeSyntheticEvent, Platform } from 'react-native';
import {
  clamp,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  WebViewScrollEvent,
  WebViewSharedProps,
} from 'react-native-webview/lib/WebViewTypes';

// todo move to file

export const useWebviewGesture = () => {
  const { safeTop } = useSafeSizes();
  const scrollPositionRef = useRef<number | undefined>(undefined);
  const startScrollPositionRef = useRef<number | undefined>(undefined);
  const touchPositionYRef = useRef<number | undefined>(undefined);
  const shouldCollapseBottomBar = useSharedValue(false);
  const tabBarOffset = useDerivedValue(() => {
    return withTiming(
      shouldCollapseBottomBar.value ? EXTRA_MIN_MARGIN : EXTRA_WEBVIEW_HEIGHT,
      {
        duration: 200,
      },
    );
  }, [shouldCollapseBottomBar]);

  const tabBarTranslateY = useDerivedValue(() => {
    return withTiming(
      shouldCollapseBottomBar.value ? EXTRA_WEBVIEW_HEIGHT : 0,
      {
        duration: 200,
      },
    );
  }, [shouldCollapseBottomBar]);

  const animatedTabBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

  const webviewContainerStyle = useAnimatedStyle(() => ({
    marginBottom: tabBarOffset.value,
  }));

  const onScroll: WebViewSharedProps['onScroll'] = event => {
    const previousScrollY = scrollPositionRef.current;
    const scrollY = event.nativeEvent.contentOffset.y;

    scrollPositionRef.current = scrollY;

    const contentHeight = event.nativeEvent.contentSize.height;

    if (contentHeight < WEBVIEW_HEIGHT - safeTop + EXTRA_WEBVIEW_HEIGHT) {
      shouldCollapseBottomBar.value = false;
      return;
    }

    if (startScrollPositionRef.current === undefined) {
      return;
    }
    if (startScrollPositionRef.current > contentHeight) {
      startScrollPositionRef.current = contentHeight;
    }

    const clampedScrollY = clamp(scrollY, 0, contentHeight);
    const scrollDelta = clampedScrollY - startScrollPositionRef.current;
    const isScrollingUp = scrollY - startScrollPositionRef.current < 0;
    const didScrollToTop =
      clampedScrollY === 0 &&
      previousScrollY !== undefined &&
      previousScrollY > 0;

    if (scrollDelta > GROW_WEBVIEW_THRESHOLD) {
      shouldCollapseBottomBar.value = true;
    } else if (
      scrollDelta < -SHRINK_WEBVIEW_THRESHOLD ||
      (scrollY < 0 && isScrollingUp) ||
      didScrollToTop
    ) {
      shouldCollapseBottomBar.value = false;
    }
  };
  const onTouchStart = useMemoizedFn(event => {
    if (scrollPositionRef.current !== undefined) {
      startScrollPositionRef.current = Math.max(0, scrollPositionRef.current);
    }
  });
  const onTouchMove = useMemoizedFn(event => {
    const isScrollingUp =
      touchPositionYRef.current &&
      event.nativeEvent.pageY > touchPositionYRef.current;
    touchPositionYRef.current = isScrollingUp
      ? event.nativeEvent.pageY - 1
      : event.nativeEvent.pageY;

    if (
      startScrollPositionRef.current === undefined &&
      scrollPositionRef.current !== undefined
    ) {
      startScrollPositionRef.current = Math.max(0, scrollPositionRef.current);
    }
  });
  const onTouchEnd = useMemoizedFn(event => {
    const isScrollingUp =
      touchPositionYRef.current &&
      event.nativeEvent.pageY > touchPositionYRef.current;

    if (
      isScrollingUp &&
      (scrollPositionRef.current === 0 ||
        scrollPositionRef.current === undefined)
    ) {
      shouldCollapseBottomBar.value = false;
    }

    touchPositionYRef.current = undefined;
  });

  const resetScrollHandlers = useMemoizedFn(() => {
    startScrollPositionRef.current = undefined;
    scrollPositionRef.current = undefined;
    touchPositionYRef.current = undefined;
  });

  return {
    onScroll,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    resetScrollHandlers,
    animatedTabBarStyle,
    webviewContainerStyle,
  };
};
