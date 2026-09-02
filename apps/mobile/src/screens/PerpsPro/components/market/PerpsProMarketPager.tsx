import { IS_IOS } from '@/core/native/utils';
import React, {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PagerView, {
  type PageScrollStateChangedNativeEvent,
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useEvent,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  animatePerpsProTabIndicator,
  snapPerpsProTabIndicator,
} from '../common/PerpsProTabIndicator';
import { usePerpsProPagerPreviewSession } from '../common/usePerpsProPagerPreviewSession';

export type PerpsProMarketPagerHandle = {
  setPage: (position: number) => void;
  setPageWithoutAnimation: (
    position: number,
    animateIndicator?: boolean,
  ) => void;
};

type PerpsProMarketPagerProps = {
  children: ReactNode;
  indicatorPosition: SharedValue<number>;
  initialPage: number;
  onPagePreview: (position: number | null) => void;
  onPageSelected: (position: number) => void;
  pageWidth: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const clampPagePosition = (position: number, pageCount: number) =>
  Math.max(0, Math.min(pageCount - 1, position));

const getPagePositionFromOffset = (
  offsetX: number,
  pageWidth: number,
  pageCount: number,
) => clampPagePosition(Math.round(offsetX / Math.max(1, pageWidth)), pageCount);

const PAGE_OFFSET_EPSILON = 0.5;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const IosPerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>(
  (
    {
      children,
      indicatorPosition,
      initialPage,
      onPagePreview,
      onPageSelected,
      pageWidth,
      style,
      testID,
    },
    ref,
  ) => {
    const scrollViewRef =
      useRef<React.ElementRef<typeof Animated.ScrollView>>(null);
    const pageCount = Children.count(children);
    const initialPageRef = useRef(clampPagePosition(initialPage, pageCount));
    const settledPageRef = useRef(initialPageRef.current);
    const isPreviewGestureActive = useSharedValue(false);
    const isProgrammaticScrollActive = useSharedValue(false);
    const previewGestureSessionId = useSharedValue(0);
    const previewPagePosition = useSharedValue(initialPageRef.current);
    const previousPageWidthRef = useRef(pageWidth);
    const initialContentOffsetRef = useRef({
      x: initialPageRef.current * pageWidth,
      y: 0,
    });
    const iosPageStyle = useMemo(
      () => [styles.iosPage, { flexBasis: pageWidth, width: pageWidth }],
      [pageWidth],
    );
    const {
      beginPreviewSession,
      finishPreviewSession,
      publishPreview,
      resetPreviewSession,
    } = usePerpsProPagerPreviewSession({
      gestureSessionId: previewGestureSessionId,
      isGestureActive: isPreviewGestureActive,
      onPreview: onPagePreview,
    });

    const commitPagePosition = useCallback(
      (position: number, snapIndicator = true) => {
        const nextPosition = clampPagePosition(position, pageCount);
        const sessionId = previewGestureSessionId.value;
        isPreviewGestureActive.value = false;
        isProgrammaticScrollActive.value = false;
        previewPagePosition.value = nextPosition;
        if (snapIndicator) {
          snapPerpsProTabIndicator(indicatorPosition, nextPosition);
        }
        if (nextPosition === settledPageRef.current) {
          finishPreviewSession(sessionId, true);
          return;
        }
        finishPreviewSession(sessionId, false);
        settledPageRef.current = nextPosition;
        onPageSelected(nextPosition);
      },
      [
        finishPreviewSession,
        indicatorPosition,
        isPreviewGestureActive,
        isProgrammaticScrollActive,
        onPageSelected,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
      ],
    );

    const handleScroll = useAnimatedScrollHandler(
      {
        onBeginDrag: () => {
          const sessionId = previewGestureSessionId.value + 1;
          previewGestureSessionId.value = sessionId;
          isPreviewGestureActive.value = true;
          isProgrammaticScrollActive.value = false;
          runOnJS(beginPreviewSession)(sessionId);
        },
        onScroll: event => {
          if (
            !isPreviewGestureActive.value &&
            !isProgrammaticScrollActive.value
          ) {
            return;
          }
          const rawPosition = Math.max(
            0,
            Math.min(
              pageCount - 1,
              event.contentOffset.x / Math.max(1, pageWidth),
            ),
          );
          indicatorPosition.value = rawPosition;
          if (!isPreviewGestureActive.value) {
            return;
          }
          const nextPosition = Math.round(rawPosition);
          if (nextPosition === previewPagePosition.value) {
            return;
          }
          previewPagePosition.value = nextPosition;
          runOnJS(publishPreview)(previewGestureSessionId.value, nextPosition);
        },
      },
      [
        beginPreviewSession,
        indicatorPosition,
        isPreviewGestureActive,
        isProgrammaticScrollActive,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        publishPreview,
      ],
    );

    const scrollToPage = useCallback(
      (position: number, animated: boolean, animateIndicator: boolean) => {
        const nextPosition = clampPagePosition(position, pageCount);
        resetPreviewSession();
        isProgrammaticScrollActive.value = animated;
        if (!animated) {
          if (animateIndicator) {
            animatePerpsProTabIndicator(indicatorPosition, nextPosition);
          } else {
            snapPerpsProTabIndicator(indicatorPosition, nextPosition);
          }
        }
        scrollViewRef.current?.scrollTo({
          animated,
          x: nextPosition * pageWidth,
          y: 0,
        });
        if (!animated) {
          commitPagePosition(nextPosition, false);
        }
      },
      [
        commitPagePosition,
        indicatorPosition,
        isProgrammaticScrollActive,
        pageCount,
        pageWidth,
        resetPreviewSession,
      ],
    );

    useLayoutEffect(() => {
      if (previousPageWidthRef.current === pageWidth) {
        return;
      }
      previousPageWidthRef.current = pageWidth;
      isProgrammaticScrollActive.value = false;
      snapPerpsProTabIndicator(indicatorPosition, settledPageRef.current);
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: settledPageRef.current * pageWidth,
        y: 0,
      });
    }, [indicatorPosition, isProgrammaticScrollActive, pageWidth]);

    useImperativeHandle(
      ref,
      () => ({
        setPage: position => scrollToPage(position, true, false),
        setPageWithoutAnimation: (position, animateIndicator = false) =>
          scrollToPage(position, false, animateIndicator),
      }),
      [scrollToPage],
    );

    const handleScrollEndDrag = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const targetOffsetX =
          event.nativeEvent.targetContentOffset?.x ?? contentOffsetX;
        if (Math.abs(targetOffsetX - contentOffsetX) > PAGE_OFFSET_EPSILON) {
          return;
        }
        commitPagePosition(
          getPagePositionFromOffset(contentOffsetX, pageWidth, pageCount),
        );
      },
      [commitPagePosition, pageCount, pageWidth],
    );

    const handleMomentumScrollEnd = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        commitPagePosition(
          getPagePositionFromOffset(
            event.nativeEvent.contentOffset.x,
            pageWidth,
            pageCount,
          ),
        );
      },
      [commitPagePosition, pageCount, pageWidth],
    );

    const pages = Children.toArray(children).map((child, index) => (
      <View
        collapsable={false}
        key={
          isValidElement(child) && child.key != null ? child.key : String(child)
        }
        style={iosPageStyle}
        testID={testID ? `${testID}-page-${index}` : undefined}>
        {child}
      </View>
    ));

    return (
      <Animated.ScrollView
        alwaysBounceHorizontal={false}
        bounces={false}
        contentOffset={initialContentOffsetRef.current}
        decelerationRate="fast"
        directionalLockEnabled
        disableIntervalMomentum
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        ref={scrollViewRef}
        scrollEventThrottle={16}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={pageWidth}
        style={style}
        testID={testID}>
        {pages}
      </Animated.ScrollView>
    );
  },
);

IosPerpsProMarketPager.displayName = 'IosPerpsProMarketPager';

const AndroidPerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>(
  (
    {
      children,
      indicatorPosition,
      initialPage,
      onPagePreview,
      onPageSelected,
      style,
      testID,
    },
    ref,
  ) => {
    const pagerRef = useRef<PagerView>(null);
    const pageCount = Children.count(children);
    const isPreviewGestureActive = useSharedValue(false);
    const isIndicatorScrollActive = useSharedValue(false);
    const isProgrammaticScrollActive = useSharedValue(false);
    const programmaticTargetPosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
    const preserveIndicatorOnSelection = useSharedValue(false);
    const previewGestureSessionId = useSharedValue(0);
    const settledPagePosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
    const previewPagePosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
    const {
      beginPreviewSession,
      finishPreviewSession,
      publishPreview,
      resetPreviewSession,
    } = usePerpsProPagerPreviewSession({
      gestureSessionId: previewGestureSessionId,
      isGestureActive: isPreviewGestureActive,
      onPreview: onPagePreview,
    });

    useImperativeHandle(
      ref,
      () => ({
        setPage: position => {
          const nextPosition = clampPagePosition(position, pageCount);
          resetPreviewSession();
          preserveIndicatorOnSelection.value = false;
          programmaticTargetPosition.value = nextPosition;
          isIndicatorScrollActive.value = true;
          isProgrammaticScrollActive.value = true;
          pagerRef.current?.setPage(nextPosition);
        },
        setPageWithoutAnimation: (position, animateIndicator = false) => {
          const nextPosition = clampPagePosition(position, pageCount);
          resetPreviewSession();
          isIndicatorScrollActive.value = false;
          isProgrammaticScrollActive.value = false;
          programmaticTargetPosition.value = nextPosition;
          preserveIndicatorOnSelection.value = animateIndicator;
          if (animateIndicator) {
            animatePerpsProTabIndicator(indicatorPosition, nextPosition);
          } else {
            snapPerpsProTabIndicator(indicatorPosition, nextPosition);
          }
          pagerRef.current?.setPageWithoutAnimation(nextPosition);
        },
      }),
      [
        indicatorPosition,
        isIndicatorScrollActive,
        isProgrammaticScrollActive,
        pageCount,
        preserveIndicatorOnSelection,
        programmaticTargetPosition,
        resetPreviewSession,
      ],
    );

    const handlePageScrollStateChanged =
      useEvent<PageScrollStateChangedNativeEvent>(
        event => {
          'worklet';
          if (event.pageScrollState === 'dragging') {
            const sessionId = previewGestureSessionId.value + 1;
            previewGestureSessionId.value = sessionId;
            isPreviewGestureActive.value = true;
            isIndicatorScrollActive.value = true;
            isProgrammaticScrollActive.value = false;
            preserveIndicatorOnSelection.value = false;
            runOnJS(beginPreviewSession)(sessionId);
            return;
          }
          if (event.pageScrollState === 'idle') {
            const wasIndicatorScrollActive = isIndicatorScrollActive.value;
            const wasProgrammaticScrollActive =
              isProgrammaticScrollActive.value;
            isIndicatorScrollActive.value = false;
            isProgrammaticScrollActive.value = false;
            if (
              wasIndicatorScrollActive &&
              (wasProgrammaticScrollActive ||
                previewPagePosition.value === settledPagePosition.value)
            ) {
              indicatorPosition.value = wasProgrammaticScrollActive
                ? programmaticTargetPosition.value
                : settledPagePosition.value;
            }
            const sessionId = previewGestureSessionId.value;
            const shouldFinishPreviewSession = isPreviewGestureActive.value;
            const shouldClearPreview =
              previewPagePosition.value === settledPagePosition.value;
            isPreviewGestureActive.value = false;
            if (shouldFinishPreviewSession) {
              runOnJS(finishPreviewSession)(sessionId, shouldClearPreview);
            }
          }
        },
        ['onPageScrollStateChanged'],
        true,
      );

    const handlePageScroll = useEvent<PagerViewOnPageScrollEvent>(
      event => {
        'worklet';
        if (!isIndicatorScrollActive.value) {
          return;
        }
        const rawPosition = Math.max(
          0,
          Math.min(pageCount - 1, event.position + event.offset),
        );
        indicatorPosition.value = rawPosition;
        if (!isPreviewGestureActive.value) {
          return;
        }
        const nextPosition = Math.round(rawPosition);
        if (nextPosition === previewPagePosition.value) {
          return;
        }
        previewPagePosition.value = nextPosition;
        runOnJS(publishPreview)(previewGestureSessionId.value, nextPosition);
      },
      ['onPageScroll'],
      true,
    );

    const handlePageSelected = useCallback(
      (event: PagerViewOnPageSelectedEvent) => {
        const position = clampPagePosition(
          event.nativeEvent.position,
          pageCount,
        );
        const sessionId = previewGestureSessionId.value;
        isPreviewGestureActive.value = false;
        settledPagePosition.value = position;
        previewPagePosition.value = position;
        const shouldPreserveIndicator =
          preserveIndicatorOnSelection.value &&
          programmaticTargetPosition.value === position;
        preserveIndicatorOnSelection.value = false;
        if (!shouldPreserveIndicator && !isIndicatorScrollActive.value) {
          snapPerpsProTabIndicator(indicatorPosition, position);
        }
        finishPreviewSession(sessionId, false);
        onPageSelected(position);
      },
      [
        finishPreviewSession,
        indicatorPosition,
        isIndicatorScrollActive,
        isPreviewGestureActive,
        onPageSelected,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
        preserveIndicatorOnSelection,
        programmaticTargetPosition,
        settledPagePosition,
      ],
    );

    return (
      <AnimatedPagerView
        initialPage={initialPage}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
        ref={pagerRef}
        style={style}
        testID={testID}>
        {children}
      </AnimatedPagerView>
    );
  },
);

AndroidPerpsProMarketPager.displayName = 'AndroidPerpsProMarketPager';

export const PerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>((props, ref) =>
  IS_IOS ? (
    <IosPerpsProMarketPager {...props} ref={ref} />
  ) : (
    <AndroidPerpsProMarketPager {...props} ref={ref} />
  ),
);

PerpsProMarketPager.displayName = 'PerpsProMarketPager';

const styles = StyleSheet.create({
  iosPage: {
    flexGrow: 0,
    flexShrink: 0,
    height: '100%',
  },
});
