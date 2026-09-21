import React, { type Ref } from 'react';
import {
  SectionList as RNSectionList,
  type SectionListProps as RNSectionListProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { RNGHScrollView } from '../reexports';
import {
  useAfterMountEffect,
  useChainCallback,
  useCollapsibleStyle,
  useConvertAnimatedToValue,
  useScrollHandlerY,
  useSharedAnimatedRef,
  useTabNameContext,
  useTabsContext,
  useUpdateScrollViewContentSize,
} from 'react-native-collapsible-tab-view/src/hooks';

type FinalProps<T, SectionT> = RNSectionListProps<T, SectionT> &
  Pick<
    React.ComponentProps<typeof RNGHScrollView>,
    'simultaneousHandlers' | 'waitFor'
  >;
type AnySectionListProps = FinalProps<any, any>;
type AnySectionList = RNSectionList<any>;

const AnimatedSectionList = Animated.createAnimatedComponent(RNSectionList);
const FinalView = AnimatedSectionList as React.ComponentType<
  AnySectionListProps & React.RefAttributes<AnySectionList>
>;

const SectionListMemo = React.memo(
  ({
    ref,
    simultaneousHandlers,
    waitFor,
    ...props
  }: AnySectionListProps & { ref?: Ref<AnySectionList> }) => {
    const renderScrollComponent = React.useCallback(
      (scrollProps: React.ComponentProps<typeof RNGHScrollView>) => (
        <RNGHScrollView
          {...scrollProps}
          simultaneousHandlers={simultaneousHandlers}
          waitFor={waitFor}
        />
      ),
      [simultaneousHandlers, waitFor],
    );

    return (
      <FinalView
        // Reanimated's generated ref type loses RN SectionList's generic API.
        ref={ref as any}
        {...props}
        renderScrollComponent={renderScrollComponent}
      />
    );
  },
);

export function TabsSectionList<T, SectionT>({
  contentContainerStyle,
  style,
  onContentSizeChange,
  refreshControl,
  ref,
  ...rest
}: Omit<FinalProps<T, SectionT>, 'onScroll'> & {
  ref?: Ref<RNSectionList<T, SectionT>>;
}) {
  const name = useTabNameContext();
  const { setRef, contentInset } = useTabsContext();
  const innerRef = useSharedAnimatedRef<AnySectionList>(
    (ref as Ref<AnySectionList>) ?? null,
  );
  const { scrollHandler, enable } = useScrollHandlerY(name);
  const onLayout = useAfterMountEffect(rest.onLayout, () => {
    'worklet';
    enable(true);
  });
  const {
    style: collapsibleStyle,
    contentContainerStyle: collapsibleContentContainerStyle,
    progressViewOffset,
  } = useCollapsibleStyle();

  React.useEffect(() => {
    setRef(name, innerRef);
  }, [innerRef, name, setRef]);

  const updateContentSize = useUpdateScrollViewContentSize({ name });
  const onContentSizeChangeHandlers = useChainCallback(
    React.useMemo(
      () => [updateContentSize, onContentSizeChange],
      [onContentSizeChange, updateContentSize],
    ),
  );
  const memoRefreshControl = React.useMemo(
    () =>
      refreshControl &&
      React.cloneElement(refreshControl, {
        progressViewOffset,
        ...refreshControl.props,
      }),
    [progressViewOffset, refreshControl],
  );
  const contentInsetValue = useConvertAnimatedToValue(contentInset);
  const memoContentInset = React.useMemo(
    () => ({ top: contentInsetValue }),
    [contentInsetValue],
  );
  const memoContentOffset = React.useMemo(
    () => ({ x: 0, y: -contentInsetValue }),
    [contentInsetValue],
  );

  return (
    <SectionListMemo
      {...(rest as AnySectionListProps)}
      onLayout={onLayout}
      ref={innerRef as Ref<AnySectionList>}
      bouncesZoom={false}
      style={[collapsibleStyle, style]}
      contentContainerStyle={[
        collapsibleContentContainerStyle,
        contentContainerStyle,
      ]}
      progressViewOffset={progressViewOffset}
      onScroll={scrollHandler}
      onContentSizeChange={onContentSizeChangeHandlers}
      scrollEventThrottle={16}
      contentInset={memoContentInset}
      contentOffset={memoContentOffset}
      automaticallyAdjustContentInsets={false}
      refreshControl={memoRefreshControl}
      onMomentumScrollEnd={() => {}}
    />
  );
}
