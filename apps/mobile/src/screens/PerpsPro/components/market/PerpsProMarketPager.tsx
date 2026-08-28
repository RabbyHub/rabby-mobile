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
} from 'react-native-reanimated';

import { usePerpsProPagerPreviewSession } from '../common/usePerpsProPagerPreviewSession';

export type PerpsProMarketPagerHandle = {
  setPage: (position: number) => void;
  setPageWithoutAnimation: (position: number) => void;
};

type PerpsProMarketPagerProps = {
  children: ReactNode;
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
      (position: number) => {
        const nextPosition = clampPagePosition(position, pageCount);
        const sessionId = previewGestureSessionId.value;
        isPreviewGestureActive.value = false;
        previewPagePosition.value = nextPosition;
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
        isPreviewGestureActive,
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
          runOnJS(beginPreviewSession)(sessionId);
        },
        onScroll: event => {
          if (!isPreviewGestureActive.value) {
            return;
          }
          const nextPosition = Math.max(
            0,
            Math.min(
              pageCount - 1,
              Math.round(event.contentOffset.x / Math.max(1, pageWidth)),
            ),
          );
          if (nextPosition === previewPagePosition.value) {
            return;
          }
          previewPagePosition.value = nextPosition;
          runOnJS(publishPreview)(previewGestureSessionId.value, nextPosition);
        },
      },
      [
        beginPreviewSession,
        isPreviewGestureActive,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        publishPreview,
      ],
    );

    const scrollToPage = useCallback(
      (position: number, animated: boolean) => {
        const nextPosition = clampPagePosition(position, pageCount);
        resetPreviewSession();
        scrollViewRef.current?.scrollTo({
          animated,
          x: nextPosition * pageWidth,
          y: 0,
        });
        if (!animated) {
          commitPagePosition(nextPosition);
        }
      },
      [commitPagePosition, pageCount, pageWidth, resetPreviewSession],
    );

    useLayoutEffect(() => {
      if (previousPageWidthRef.current === pageWidth) {
        return;
      }
      previousPageWidthRef.current = pageWidth;
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: settledPageRef.current * pageWidth,
        y: 0,
      });
    }, [pageWidth]);

    useImperativeHandle(
      ref,
      () => ({
        setPage: position => scrollToPage(position, true),
        setPageWithoutAnimation: position => scrollToPage(position, false),
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
    { children, initialPage, onPagePreview, onPageSelected, style, testID },
    ref,
  ) => {
    const pagerRef = useRef<PagerView>(null);
    const pageCount = Children.count(children);
    const isPreviewGestureActive = useSharedValue(false);
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
          resetPreviewSession();
          pagerRef.current?.setPage(position);
        },
        setPageWithoutAnimation: position => {
          resetPreviewSession();
          pagerRef.current?.setPageWithoutAnimation(position);
        },
      }),
      [resetPreviewSession],
    );

    const handlePageScrollStateChanged =
      useEvent<PageScrollStateChangedNativeEvent>(
        event => {
          'worklet';
          if (event.pageScrollState === 'dragging') {
            const sessionId = previewGestureSessionId.value + 1;
            previewGestureSessionId.value = sessionId;
            isPreviewGestureActive.value = true;
            runOnJS(beginPreviewSession)(sessionId);
            return;
          }
          if (event.pageScrollState === 'idle') {
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
        if (!isPreviewGestureActive.value) {
          return;
        }
        const nextPosition = Math.max(
          0,
          Math.min(pageCount - 1, Math.round(event.position + event.offset)),
        );
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
        finishPreviewSession(sessionId, false);
        onPageSelected(position);
      },
      [
        finishPreviewSession,
        isPreviewGestureActive,
        onPageSelected,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
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
