import { IS_IOS } from '@/core/native/utils';
import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewProps,
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

const getSettledPagePosition = (
  event: NativeSyntheticEvent<NativeScrollEvent>,
  pageWidth: number,
  pageCount: number,
) => {
  const eventWidth = event.nativeEvent.layoutMeasurement.width;
  const resolvedPageWidth = eventWidth > 0 ? eventWidth : pageWidth;
  const targetX =
    event.nativeEvent.targetContentOffset?.x ??
    event.nativeEvent.contentOffset.x;

  return clampPagePosition(Math.round(targetX / resolvedPageWidth), pageCount);
};

const IosPerpsProMarketPager = forwardRef<
  PerpsProMarketPagerHandle,
  PerpsProMarketPagerProps
>(
  (
    { children, initialPage, onPageSelected, pageWidth, style, testID },
    ref,
  ) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const currentPageRef = useRef(initialPage);
    const pageCount = Children.count(children);
    const initialContentOffset = useMemo(
      () => ({ x: initialPage * pageWidth, y: 0 }),
      [initialPage, pageWidth],
    );

    const scrollToPage = useCallback(
      (position: number, animated: boolean) => {
        const nextPosition = clampPagePosition(position, pageCount);
        currentPageRef.current = nextPosition;
        scrollViewRef.current?.scrollTo({
          animated,
          x: nextPosition * pageWidth,
          y: 0,
        });
      },
      [pageCount, pageWidth],
    );

    useImperativeHandle(
      ref,
      () => ({
        setPage: position => scrollToPage(position, true),
        setPageWithoutAnimation: position => scrollToPage(position, false),
      }),
      [scrollToPage],
    );

    const commitSettledPage = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const nextPosition = getSettledPagePosition(
          event,
          pageWidth,
          pageCount,
        );
        if (nextPosition === currentPageRef.current) {
          return;
        }
        currentPageRef.current = nextPosition;
        onPageSelected(nextPosition);
      },
      [onPageSelected, pageCount, pageWidth],
    );

    const pages = Children.map(children, child => {
      if (!isValidElement<ViewProps>(child)) {
        return child;
      }
      return cloneElement(child as ReactElement<ViewProps>, {
        style: [child.props.style, styles.iosPage, { width: pageWidth }],
      });
    });

    return (
      <ScrollView
        alwaysBounceHorizontal={false}
        bounces={false}
        contentOffset={initialContentOffset}
        directionalLockEnabled
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={commitSettledPage}
        onScrollEndDrag={commitSettledPage}
        pagingEnabled
        ref={scrollViewRef}
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
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
    height: '100%',
  },
});
