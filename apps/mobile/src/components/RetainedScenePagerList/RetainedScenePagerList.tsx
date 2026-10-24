import React, { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  SceneList,
  type SceneListHandle,
  type SceneListProps,
} from '@rabby-wallet/rn-collapsible-scene-view';
import {
  RetainedScenePagerBody,
  type RetainedScenePagerBodyHandle,
  type RetainedScenePagerContentProps,
} from './RetainedScenePagerBody';

export { RetainedScenePagerBody } from './RetainedScenePagerBody';
export type {
  RetainedScenePagerBodyHandle,
  RetainedScenePagerPageContext,
} from './RetainedScenePagerBody';

const PAGER_CELL = ['retained-pager'];
const pagerKey = (key: string) => key;

export type RetainedScenePagerListHandle = SceneListHandle<unknown> &
  RetainedScenePagerBodyHandle;

type Props<Row extends { key: string }> = Pick<
  SceneListProps<string>,
  | 'nativeRef'
  | 'nativeScrollY'
  | 'onContentSizeChange'
  | 'onLayout'
  | 'style'
  | 'testID'
> &
  RetainedScenePagerContentProps<Row> & {
    listHeader: React.ReactElement;
    ref?: React.Ref<RetainedScenePagerListHandle>;
  };

/** The only physical vertical owner. Horizontal bodies and their child
 * FlatLists stay below this list's real cell/context, without another SceneList.
 */
export function RetainedScenePagerList<Row extends { key: string }>({
  listHeader,
  ref,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  style,
  testID = 'retained-scene',
  ...pagerProps
}: Props<Row>) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const outerRef = useRef<SceneListHandle<string>>(null);
  const pagerRef = useRef<RetainedScenePagerBodyHandle>(null);
  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (offset, animated) =>
        outerRef.current?.scrollTo(offset, animated),
      scrollToOffset: (offset, animated) =>
        outerRef.current?.scrollToOffset(offset, animated),
      selectTab: key => pagerRef.current?.selectTab(key),
    }),
    [],
  );
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      setViewportHeight(event.nativeEvent.layout.height);
      onLayout?.(event);
    },
    [onLayout],
  );
  const renderPager = () => (
    <RetainedScenePagerBody
      {...pagerProps}
      ref={pagerRef}
      viewportHeight={viewportHeight}
      testID={testID}
    />
  );
  return (
    <SceneList
      data={PAGER_CELL}
      keyExtractor={pagerKey}
      renderItem={renderPager}
      ListHeaderComponent={listHeader}
      contentInsetTop={0}
      nativeRef={nativeRef}
      nativeScrollY={nativeScrollY}
      onContentSizeChange={onContentSizeChange}
      onLayout={layout}
      ref={outerRef}
      tabKey={pagerProps.activeKey}
      style={style}
      testID={testID}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled
      scrollsToTop
    />
  );
}
