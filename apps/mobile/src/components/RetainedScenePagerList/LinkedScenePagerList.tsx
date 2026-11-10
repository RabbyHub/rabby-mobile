import React, {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  LinkedScenePager,
  type LinkedScenePagerHandle,
  type LinkedScenePagerProps,
} from '@rabby-wallet/rn-collapsible-scene-view/src/LinkedScenePager';
import {
  SceneList,
  type SceneListHandle,
  type SceneListProps,
} from '@rabby-wallet/rn-collapsible-scene-view/src/SceneList';
import { linkedScenePhysicalKey } from '@rabby-wallet/rn-collapsible-scene-view/src/linkedSceneModel';
import { RootScenePagerGestureBlock } from '@rabby-wallet/rn-collapsible-scene-view/src/RootScenePager';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';

const PAGER_CELL = ['linked-pager'];
const pagerKey = (key: string) => key;

export type LinkedScenePagerListHandle = SceneListHandle<unknown> &
  LinkedScenePagerHandle;

export type LinkedScenePagerListProps = Pick<
  SceneListProps<string>,
  | 'nativeRef'
  | 'nativeScrollY'
  | 'onContentSizeChange'
  | 'onLayout'
  | 'style'
  | 'testID'
> &
  Omit<LinkedScenePagerProps, 'viewportHeight' | 'ref'> & {
    listHeader: React.ReactElement;
    /** Exclude only the linked cell, never its outer vertical list/header. */
    protectRootGesture?: boolean;
    ref?: React.Ref<LinkedScenePagerListHandle>;
  };

/**
 * App activity adapter and the one physical vertical owner for either paging
 * mode. Rendered leaf FlatLists inherit this real cell's vertical list context.
 */
export function LinkedScenePagerList({
  listHeader,
  protectRootGesture = false,
  ref,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  style,
  activityEnabled,
  renderLeaf,
  renderGroupHeader,
  testID = 'linked-scene',
  ...pagerProps
}: LinkedScenePagerListProps) {
  const parentScope = useStoreActivityScope();
  const parentActive = useSyncExternalStore(
    parentScope.subscribe,
    parentScope.getActive,
    parentScope.getActive,
  );
  const [viewportHeight, setViewportHeight] = useState(0);
  const outerRef = useRef<SceneListHandle<string>>(null);
  const pagerRef = useRef<LinkedScenePagerHandle>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (offset, animated) =>
        outerRef.current?.scrollTo(offset, animated),
      scrollToOffset: (offset, animated) =>
        outerRef.current?.scrollToOffset(offset, animated),
      selectTab: key => pagerRef.current?.selectTab(key),
      selectPath: path => pagerRef.current?.selectPath(path),
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
  const renderScopedLeaf = useCallback<LinkedScenePagerProps['renderLeaf']>(
    (path, context) => (
      <StoreActivityBoundary
        active={context.active}
        label={`${testID}:leaf:${linkedScenePhysicalKey(path)}`}>
        {renderLeaf(path, context)}
      </StoreActivityBoundary>
    ),
    [renderLeaf, testID],
  );
  const renderScopedGroupHeader = useCallback<
    NonNullable<LinkedScenePagerProps['renderGroupHeader']>
  >(
    (key, context) => (
      <StoreActivityBoundary
        active={context.active}
        label={`${testID}:group:${key}`}>
        {renderGroupHeader?.(key, context)}
      </StoreActivityBoundary>
    ),
    [renderGroupHeader, testID],
  );
  const renderPager = () => {
    const pager = (
      <LinkedScenePager
        {...pagerProps}
        ref={pagerRef}
        activityEnabled={activityEnabled && parentActive}
        renderLeaf={renderScopedLeaf}
        renderGroupHeader={
          renderGroupHeader ? renderScopedGroupHeader : undefined
        }
        viewportHeight={viewportHeight}
        testID={testID}
      />
    );
    return protectRootGesture ? (
      <RootScenePagerGestureBlock testID={`${testID}-root-gesture-block`}>
        {pager}
      </RootScenePagerGestureBlock>
    ) : (
      pager
    );
  };

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
      tabKey={pagerProps.activePath.key}
      style={style}
      testID={testID}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled
      scrollsToTop
    />
  );
}
