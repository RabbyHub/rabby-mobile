import { IS_IOS } from '@/core/native/utils';
import React, {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
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

import { snapPerpsProTabIndicator } from '../common/PerpsProTabIndicator';
import { usePerpsProPagerPreviewSession } from '../common/usePerpsProPagerPreviewSession';

export type PerpsProMarketPagerHandle = {
  setPage: (position: number) => void;
  setPageWithoutAnimation: (position: number) => void;
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
const MARKET_PAGER_TRANSITION_IDLE = 0;
const MARKET_PAGER_TRANSITION_GESTURE = 1;
const MARKET_PAGER_TRANSITION_PROGRAMMATIC = 2;
const MARKET_PAGER_TRANSITION_DIRECT = 3;
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
    const isGestureMomentumExpected = useSharedValue(false);
    const gestureMomentumTargetPosition = useSharedValue(
      initialPageRef.current,
    );
    const isPreviewGestureActive = useSharedValue(false);
    const isProgrammaticScrollActive = useSharedValue(false);
    const programmaticStartPosition = useSharedValue(initialPageRef.current);
    const programmaticTargetPosition = useSharedValue(initialPageRef.current);
    const previewGestureSessionId = useSharedValue(0);
    const previewPagePosition = useSharedValue(initialPageRef.current);
    const transitionKind = useSharedValue(MARKET_PAGER_TRANSITION_IDLE);
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
      (
        position: number,
        snapIndicator = true,
        expectedSessionId = previewGestureSessionId.value,
        expectedTransitionKind = transitionKind.value,
      ) => {
        const nextPosition = clampPagePosition(position, pageCount);
        const sessionId = previewGestureSessionId.value;
        if (
          sessionId !== expectedSessionId ||
          transitionKind.value !== expectedTransitionKind ||
          expectedTransitionKind === MARKET_PAGER_TRANSITION_IDLE
        ) {
          return;
        }
        // iOS can deliver the completion of an earlier scrollTo after a newer
        // command has already reversed direction.
        if (
          isProgrammaticScrollActive.value &&
          programmaticTargetPosition.value !== nextPosition
        ) {
          return;
        }
        isPreviewGestureActive.value = false;
        isProgrammaticScrollActive.value = false;
        isGestureMomentumExpected.value = false;
        previewPagePosition.value = nextPosition;
        transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
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
        isGestureMomentumExpected,
        isPreviewGestureActive,
        isProgrammaticScrollActive,
        onPageSelected,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
        programmaticTargetPosition,
        transitionKind,
      ],
    );

    const handleScroll = useAnimatedScrollHandler(
      {
        onBeginDrag: () => {
          const sessionId = previewGestureSessionId.value + 1;
          previewGestureSessionId.value = sessionId;
          isGestureMomentumExpected.value = false;
          gestureMomentumTargetPosition.value = settledPageRef.current;
          isPreviewGestureActive.value = true;
          isProgrammaticScrollActive.value = false;
          previewPagePosition.value = settledPageRef.current;
          transitionKind.value = MARKET_PAGER_TRANSITION_GESTURE;
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
          if (isProgrammaticScrollActive.value) {
            // Do not let progress from the superseded destination move the
            // presentation away from the latest command.
            const minimumPosition = Math.min(
              programmaticStartPosition.value,
              programmaticTargetPosition.value,
            );
            const maximumPosition = Math.max(
              programmaticStartPosition.value,
              programmaticTargetPosition.value,
            );
            if (
              rawPosition < minimumPosition ||
              rawPosition > maximumPosition
            ) {
              return;
            }
          }
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
        gestureMomentumTargetPosition,
        isPreviewGestureActive,
        isProgrammaticScrollActive,
        isGestureMomentumExpected,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        publishPreview,
        programmaticStartPosition,
        programmaticTargetPosition,
        transitionKind,
      ],
    );

    const scrollToPage = useCallback(
      (position: number, animated: boolean) => {
        const nextPosition = clampPagePosition(position, pageCount);
        resetPreviewSession();
        previewGestureSessionId.value += 1;
        const transitionSessionId = previewGestureSessionId.value;
        previewPagePosition.value = settledPageRef.current;
        programmaticStartPosition.value = Math.max(
          0,
          Math.min(pageCount - 1, indicatorPosition.value),
        );
        programmaticTargetPosition.value = nextPosition;
        isProgrammaticScrollActive.value = animated;
        isGestureMomentumExpected.value = false;
        transitionKind.value = animated
          ? MARKET_PAGER_TRANSITION_PROGRAMMATIC
          : MARKET_PAGER_TRANSITION_DIRECT;
        if (!animated) {
          snapPerpsProTabIndicator(indicatorPosition, nextPosition);
        }
        scrollViewRef.current?.scrollTo({
          animated,
          x: nextPosition * pageWidth,
          y: 0,
        });
        if (!animated) {
          commitPagePosition(
            nextPosition,
            false,
            transitionSessionId,
            MARKET_PAGER_TRANSITION_DIRECT,
          );
        }
      },
      [
        commitPagePosition,
        indicatorPosition,
        isGestureMomentumExpected,
        isProgrammaticScrollActive,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        previewPagePosition,
        programmaticStartPosition,
        programmaticTargetPosition,
        resetPreviewSession,
        transitionKind,
      ],
    );

    useLayoutEffect(() => {
      if (previousPageWidthRef.current === pageWidth) {
        return;
      }
      const currentTransitionKind = transitionKind.value;
      const nextSettledPage =
        currentTransitionKind === MARKET_PAGER_TRANSITION_PROGRAMMATIC ||
        currentTransitionKind === MARKET_PAGER_TRANSITION_DIRECT
          ? programmaticTargetPosition.value
          : settledPageRef.current;
      const shouldCommitProgrammaticTarget =
        nextSettledPage !== settledPageRef.current;
      previousPageWidthRef.current = pageWidth;
      resetPreviewSession();
      previewGestureSessionId.value += 1;
      isGestureMomentumExpected.value = false;
      isProgrammaticScrollActive.value = false;
      transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
      settledPageRef.current = nextSettledPage;
      previewPagePosition.value = nextSettledPage;
      snapPerpsProTabIndicator(indicatorPosition, nextSettledPage);
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: nextSettledPage * pageWidth,
        y: 0,
      });
      if (shouldCommitProgrammaticTarget) {
        onPageSelected(nextSettledPage);
      }
    }, [
      indicatorPosition,
      isGestureMomentumExpected,
      isProgrammaticScrollActive,
      onPageSelected,
      pageWidth,
      previewGestureSessionId,
      previewPagePosition,
      programmaticTargetPosition,
      resetPreviewSession,
      transitionKind,
    ]);

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
        if (transitionKind.value !== MARKET_PAGER_TRANSITION_GESTURE) {
          return;
        }
        const sessionId = previewGestureSessionId.value;
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const targetOffsetX =
          event.nativeEvent.targetContentOffset?.x ?? contentOffsetX;
        if (Math.abs(targetOffsetX - contentOffsetX) > PAGE_OFFSET_EPSILON) {
          isGestureMomentumExpected.value = true;
          gestureMomentumTargetPosition.value = getPagePositionFromOffset(
            targetOffsetX,
            pageWidth,
            pageCount,
          );
          return;
        }
        commitPagePosition(
          getPagePositionFromOffset(contentOffsetX, pageWidth, pageCount),
          true,
          sessionId,
          MARKET_PAGER_TRANSITION_GESTURE,
        );
      },
      [
        commitPagePosition,
        gestureMomentumTargetPosition,
        isGestureMomentumExpected,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        transitionKind,
      ],
    );

    const handleMomentumScrollEnd = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentTransitionKind = transitionKind.value;
        if (
          currentTransitionKind !== MARKET_PAGER_TRANSITION_PROGRAMMATIC &&
          (currentTransitionKind !== MARKET_PAGER_TRANSITION_GESTURE ||
            !isGestureMomentumExpected.value)
        ) {
          return;
        }
        const position = getPagePositionFromOffset(
          event.nativeEvent.contentOffset.x,
          pageWidth,
          pageCount,
        );
        if (
          currentTransitionKind === MARKET_PAGER_TRANSITION_GESTURE &&
          position !== gestureMomentumTargetPosition.value
        ) {
          return;
        }
        const sessionId = previewGestureSessionId.value;
        commitPagePosition(position, true, sessionId, currentTransitionKind);
      },
      [
        commitPagePosition,
        gestureMomentumTargetPosition,
        isGestureMomentumExpected,
        pageCount,
        pageWidth,
        previewGestureSessionId,
        transitionKind,
      ],
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
    const programmaticTargetPosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
    const previewGestureSessionId = useSharedValue(0);
    const transitionIdleSeen = useSharedValue(false);
    const transitionKind = useSharedValue(MARKET_PAGER_TRANSITION_IDLE);
    const transitionCandidatePosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
    const transitionSelectedPosition = useSharedValue(-1);
    const transitionProgressSeen = useSharedValue(false);
    const transitionStartPosition = useSharedValue(
      clampPagePosition(initialPage, pageCount),
    );
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
    const mountedRef = useRef(true);
    const lastCommittedTransitionRef = useRef<{
      position: number;
      sessionId: number;
    } | null>(null);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const commitSelectedTransition = useCallback(
      (sessionId: number, position: number) => {
        // onPageSelected is captured on the UI runtime. A newer drag may have
        // started before this runOnJS callback gets a JS turn.
        if (!mountedRef.current) {
          return;
        }
        const lastCommitted = lastCommittedTransitionRef.current;
        if (lastCommitted && sessionId <= lastCommitted.sessionId) {
          return;
        }
        lastCommittedTransitionRef.current = { position, sessionId };
        finishPreviewSession(sessionId, false);
        onPageSelected(position);
      },
      [finishPreviewSession, onPageSelected],
    );

    const finishCanceledTransition = useCallback(
      (sessionId: number) => {
        if (
          !mountedRef.current ||
          previewGestureSessionId.value !== sessionId ||
          transitionKind.value !== MARKET_PAGER_TRANSITION_IDLE
        ) {
          return;
        }
        finishPreviewSession(sessionId, true);
      },
      [finishPreviewSession, previewGestureSessionId, transitionKind],
    );

    const startProgrammaticTransition = useCallback(
      (position: number) => {
        const nextPosition = clampPagePosition(position, pageCount);
        resetPreviewSession();
        previewGestureSessionId.value += 1;
        isPreviewGestureActive.value = false;
        programmaticTargetPosition.value = nextPosition;
        transitionIdleSeen.value = false;
        transitionKind.value = MARKET_PAGER_TRANSITION_PROGRAMMATIC;
        transitionCandidatePosition.value = nextPosition;
        transitionSelectedPosition.value = -1;
        transitionProgressSeen.value = false;
        transitionStartPosition.value = Math.max(
          0,
          Math.min(pageCount - 1, indicatorPosition.value),
        );
        previewPagePosition.value = settledPagePosition.value;
        isIndicatorScrollActive.value = true;
        pagerRef.current?.setPage(nextPosition);
      },
      [
        indicatorPosition,
        isIndicatorScrollActive,
        isPreviewGestureActive,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
        programmaticTargetPosition,
        resetPreviewSession,
        settledPagePosition,
        transitionCandidatePosition,
        transitionIdleSeen,
        transitionKind,
        transitionProgressSeen,
        transitionSelectedPosition,
        transitionStartPosition,
      ],
    );

    const startDirectTransition = useCallback(
      (position: number) => {
        const nextPosition = clampPagePosition(position, pageCount);
        resetPreviewSession();
        previewGestureSessionId.value += 1;
        isPreviewGestureActive.value = false;
        isIndicatorScrollActive.value = false;
        programmaticTargetPosition.value = nextPosition;
        transitionIdleSeen.value = false;
        transitionKind.value = MARKET_PAGER_TRANSITION_DIRECT;
        transitionCandidatePosition.value = nextPosition;
        transitionSelectedPosition.value = -1;
        transitionProgressSeen.value = false;
        transitionStartPosition.value = nextPosition;
        previewPagePosition.value = nextPosition;
        snapPerpsProTabIndicator(indicatorPosition, nextPosition);
        pagerRef.current?.setPageWithoutAnimation(nextPosition);
      },
      [
        indicatorPosition,
        isIndicatorScrollActive,
        isPreviewGestureActive,
        pageCount,
        previewGestureSessionId,
        previewPagePosition,
        programmaticTargetPosition,
        resetPreviewSession,
        transitionCandidatePosition,
        transitionIdleSeen,
        transitionKind,
        transitionProgressSeen,
        transitionSelectedPosition,
        transitionStartPosition,
      ],
    );

    const resumeSupersededProgrammaticTransition = useCallback(
      (
        sessionId: number,
        targetPosition: number,
        expectedTransitionKind: number,
      ) => {
        if (
          previewGestureSessionId.value !== sessionId ||
          transitionKind.value !== expectedTransitionKind ||
          programmaticTargetPosition.value !== targetPosition
        ) {
          return;
        }
        if (expectedTransitionKind === MARKET_PAGER_TRANSITION_DIRECT) {
          startDirectTransition(targetPosition);
          return;
        }
        startProgrammaticTransition(targetPosition);
      },
      [
        previewGestureSessionId,
        programmaticTargetPosition,
        startDirectTransition,
        startProgrammaticTransition,
        transitionKind,
      ],
    );

    useImperativeHandle(
      ref,
      () => ({
        setPage: startProgrammaticTransition,
        setPageWithoutAnimation: startDirectTransition,
      }),
      [startDirectTransition, startProgrammaticTransition],
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
            transitionIdleSeen.value = false;
            transitionKind.value = MARKET_PAGER_TRANSITION_GESTURE;
            transitionCandidatePosition.value = settledPagePosition.value;
            transitionSelectedPosition.value = -1;
            transitionProgressSeen.value = false;
            transitionStartPosition.value = settledPagePosition.value;
            previewPagePosition.value = settledPagePosition.value;
            runOnJS(beginPreviewSession)(sessionId);
            return;
          }
          if (event.pageScrollState === 'idle') {
            if (transitionKind.value === MARKET_PAGER_TRANSITION_IDLE) {
              return;
            }
            const sessionId = previewGestureSessionId.value;
            if (
              transitionKind.value === MARKET_PAGER_TRANSITION_PROGRAMMATIC &&
              transitionSelectedPosition.value < 0
            ) {
              if (!transitionProgressSeen.value) {
                return;
              }
              transitionIdleSeen.value = true;
              isIndicatorScrollActive.value = false;
              return;
            }
            transitionIdleSeen.value = true;
            isIndicatorScrollActive.value = false;
            if (transitionSelectedPosition.value >= 0) {
              indicatorPosition.value = transitionSelectedPosition.value;
              settledPagePosition.value = transitionSelectedPosition.value;
              previewPagePosition.value = transitionSelectedPosition.value;
              isPreviewGestureActive.value = false;
              transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
              runOnJS(commitSelectedTransition)(
                sessionId,
                transitionSelectedPosition.value,
              );
              return;
            }
            if (
              transitionKind.value === MARKET_PAGER_TRANSITION_GESTURE &&
              transitionCandidatePosition.value === settledPagePosition.value
            ) {
              indicatorPosition.value = settledPagePosition.value;
              isPreviewGestureActive.value = false;
              transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
              runOnJS(finishCanceledTransition)(sessionId);
              return;
            }
            if (transitionKind.value === MARKET_PAGER_TRANSITION_GESTURE) {
              indicatorPosition.value = transitionCandidatePosition.value;
            }
          }
        },
        ['onPageScrollStateChanged'],
        true,
      );

    const handlePageSelected = useEvent<PagerViewOnPageSelectedEvent>(
      event => {
        'worklet';
        const position = Math.max(
          0,
          Math.min(pageCount - 1, Math.round(event.position)),
        );
        const currentTransitionKind = transitionKind.value;
        if (currentTransitionKind === MARKET_PAGER_TRANSITION_IDLE) {
          return;
        }
        if (
          (currentTransitionKind === MARKET_PAGER_TRANSITION_PROGRAMMATIC ||
            currentTransitionKind === MARKET_PAGER_TRANSITION_DIRECT) &&
          programmaticTargetPosition.value !== position
        ) {
          if (position === settledPagePosition.value) {
            return;
          }
          const sessionId = previewGestureSessionId.value;
          const targetPosition = programmaticTargetPosition.value;
          settledPagePosition.value = position;
          previewPagePosition.value = position;
          isPreviewGestureActive.value = false;
          isIndicatorScrollActive.value = false;
          transitionIdleSeen.value = false;
          transitionSelectedPosition.value = -1;
          runOnJS(resumeSupersededProgrammaticTransition)(
            sessionId,
            targetPosition,
            currentTransitionKind,
          );
          return;
        }
        const sessionId = previewGestureSessionId.value;
        transitionSelectedPosition.value = position;
        if (currentTransitionKind === MARKET_PAGER_TRANSITION_DIRECT) {
          settledPagePosition.value = position;
          previewPagePosition.value = position;
          isPreviewGestureActive.value = false;
          isIndicatorScrollActive.value = false;
          transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
          indicatorPosition.value = position;
          runOnJS(commitSelectedTransition)(sessionId, position);
          return;
        }
        if (!transitionIdleSeen.value) {
          return;
        }
        settledPagePosition.value = position;
        previewPagePosition.value = position;
        isPreviewGestureActive.value = false;
        isIndicatorScrollActive.value = false;
        indicatorPosition.value = position;
        transitionKind.value = MARKET_PAGER_TRANSITION_IDLE;
        runOnJS(commitSelectedTransition)(sessionId, position);
      },
      ['onPageSelected'],
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
        if (transitionKind.value === MARKET_PAGER_TRANSITION_PROGRAMMATIC) {
          const minimumPosition = Math.min(
            transitionStartPosition.value,
            programmaticTargetPosition.value,
          );
          const maximumPosition = Math.max(
            transitionStartPosition.value,
            programmaticTargetPosition.value,
          );
          if (rawPosition < minimumPosition || rawPosition > maximumPosition) {
            return;
          }
        }
        transitionProgressSeen.value = true;
        indicatorPosition.value = rawPosition;
        if (transitionKind.value === MARKET_PAGER_TRANSITION_GESTURE) {
          transitionCandidatePosition.value = Math.round(rawPosition);
        }
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
