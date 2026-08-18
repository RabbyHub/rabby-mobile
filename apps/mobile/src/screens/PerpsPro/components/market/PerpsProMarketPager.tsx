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
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';

export type PerpsProMarketPagerHandle = {
  setPage: (position: number) => void;
  setPageWithoutAnimation: (position: number) => void;
};

type PerpsProMarketPagerProps = {
  children: ReactNode;
  initialPage: number;
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

const IosPerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>(
  (
    { children, initialPage, onPageSelected, pageWidth, style, testID },
    ref,
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const pageCount = Children.count(children);
    const initialPageRef = useRef(clampPagePosition(initialPage, pageCount));
    const settledPageRef = useRef(initialPageRef.current);
    const previousPageWidthRef = useRef(pageWidth);
    const initialContentOffsetRef = useRef({
      x: initialPageRef.current * pageWidth,
      y: 0,
    });
    const iosPageStyle = useMemo(
      () => [styles.iosPage, { flexBasis: pageWidth, width: pageWidth }],
      [pageWidth],
    );

    const commitPagePosition = useCallback(
      (position: number) => {
        const nextPosition = clampPagePosition(position, pageCount);
        if (nextPosition === settledPageRef.current) {
          return;
        }
        settledPageRef.current = nextPosition;
        onPageSelected(nextPosition);
      },
      [onPageSelected, pageCount],
    );

    const scrollToPage = useCallback(
      (position: number, animated: boolean) => {
        const nextPosition = clampPagePosition(position, pageCount);
        scrollViewRef.current?.scrollTo({
          animated,
          x: nextPosition * pageWidth,
          y: 0,
        });
        if (!animated) {
          commitPagePosition(nextPosition);
        }
      },
      [commitPagePosition, pageCount, pageWidth],
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
      <ScrollView
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
        onScrollEndDrag={handleScrollEndDrag}
        ref={scrollViewRef}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={pageWidth}
        style={style}
        testID={testID}>
        {pages}
      </ScrollView>
    );
  },
);

IosPerpsProMarketPager.displayName = 'IosPerpsProMarketPager';

const AndroidPerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>(({ children, initialPage, onPageSelected, style, testID }, ref) => {
  const pagerRef = useRef<PagerView>(null);

  useImperativeHandle(
    ref,
    () => ({
      setPage: position => pagerRef.current?.setPage(position),
      setPageWithoutAnimation: position =>
        pagerRef.current?.setPageWithoutAnimation(position),
    }),
    [],
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      onPageSelected(event.nativeEvent.position);
    },
    [onPageSelected],
  );

  return (
    <PagerView
      initialPage={initialPage}
      onPageSelected={handlePageSelected}
      ref={pagerRef}
      style={style}
      testID={testID}>
      {children}
    </PagerView>
  );
});

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
