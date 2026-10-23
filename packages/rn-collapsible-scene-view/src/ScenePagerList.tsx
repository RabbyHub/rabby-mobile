import React, { useCallback, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  type ListRenderItem,
  StyleSheet,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { SceneList, type SceneListProps } from './SceneList';
import { ScenePager, ScenePagerItem, type ScenePagerTrack } from './ScenePager';
import { calculateScenePagerPreviewWindow } from './previewWindow';

const PREVIEW_ROW_LIMIT = 10;
const PreviewKeyContext = React.createContext({
  key: null as string | null,
  offset: 0,
});
const previewSeparators = {
  highlight: () => undefined,
  unhighlight: () => undefined,
  updateProps: () => undefined,
};

export type ScenePagerListProps<Row> = Omit<SceneListProps<Row>, 'data'> & {
  dataByKey: Readonly<Record<string, readonly Row[]>>;
  keys: readonly string[];
  onBoundary?: (direction: 'next' | 'prev') => void;
  onIndexChange: (key: string) => void;
  rowStartOffset: number;
  scrollOffset: SharedValue<number>;
  /** Exact, current row extents and target content geometry; never estimates.
   * Omit while a caller has no measurement contract (legacy first-row preview).
   */
  previewGeometryByKey?: Readonly<
    Record<
      string,
      {
        rowHeights: readonly (number | null | undefined)[];
        paddingBottom?: number;
        minContentHeight?: number;
      }
    >
  >;
};

/** One persistent VirtualizedList; neighbours are bounded, non-scrolling views. */
export function ScenePagerList<Row>(props: ScenePagerListProps<Row>) {
  const { rowStartOffset, scrollOffset } = props;
  const rowRegion = useMemo(
    () => ({ startOffset: rowStartOffset, scrollOffset }),
    [rowStartOffset, scrollOffset],
  );
  return (
    <ScenePager
      activeKey={props.tabKey}
      keys={props.keys}
      onBoundary={props.onBoundary}
      onIndexChange={props.onIndexChange}
      rowRegion={rowRegion}
      testID={props.testID ? `${props.testID}-pager` : undefined}>
      {(track, previewKey, previewScrollOffset) => (
        <PagerListPreviewProvider
          previewKey={previewKey}
          offset={previewScrollOffset}>
          <PagerListContent {...props} track={track} />
        </PagerListPreviewProvider>
      )}
    </ScenePager>
  );
}

function PagerListPreviewProvider({
  children,
  previewKey,
  offset,
}: React.PropsWithChildren<{
  previewKey: string | null;
  offset: number;
}>) {
  const value = useMemo(
    () => ({ key: previewKey, offset }),
    [previewKey, offset],
  );
  return (
    <PreviewKeyContext.Provider value={value}>
      {children}
    </PreviewKeyContext.Provider>
  );
}

function PagerListContentComponent<Row>({
  dataByKey,
  keys: _keys,
  onBoundary: _onBoundary,
  onIndexChange: _onIndexChange,
  rowStartOffset,
  scrollOffset: _scrollOffset,
  ListHeaderComponent,
  onLayout,
  previewGeometryByKey,
  keyExtractor,
  renderItem,
  tabKey,
  track,
  ...listProps
}: ScenePagerListProps<Row> & { track: ScenePagerTrack }) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (previewGeometryByKey) {
        setViewportHeight(event.nativeEvent.layout.height);
      }
      onLayout?.(event);
    },
    [onLayout, previewGeometryByKey],
  );
  const Header = ListHeaderComponent;
  const headerContent = useMemo(
    () => (React.isValidElement(Header) ? Header : Header ? <Header /> : null),
    [Header],
  );
  const header = useMemo(
    () => (
      <View>
        {headerContent}
        <PagerListPreview
          dataByKey={dataByKey}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          track={track}
          previewGeometryByKey={previewGeometryByKey}
          rowStartOffset={rowStartOffset}
          viewportHeight={viewportHeight}
        />
      </View>
    ),
    [
      dataByKey,
      headerContent,
      keyExtractor,
      renderItem,
      track,
      previewGeometryByKey,
      rowStartOffset,
      viewportHeight,
    ],
  );
  const renderRow = useCallback<ListRenderItem<Row>>(
    item => (
      <ScenePagerItem pageKey={tabKey} track={track}>
        {renderItem(item)}
      </ScenePagerItem>
    ),
    [renderItem, tabKey, track],
  );
  return (
    <SceneList
      {...listProps}
      ListHeaderComponent={header}
      onLayout={handleLayout}
      data={dataByKey[tabKey] ?? []}
      keyExtractor={keyExtractor}
      // The header owns overflow previews below its measured bottom. Keep its
      // native view attached even when offscreen; row virtualization stays on.
      removeClippedSubviews={false}
      renderItem={renderRow}
      tabKey={tabKey}
    />
  );
}

// Preview updates must not rerender FlatList: its internal renderItem wrapper
// changes on each render and would otherwise invalidate all mounted cells.
const PagerListContent = React.memo(
  PagerListContentComponent,
) as typeof PagerListContentComponent;

function PagerListPreview<Row>({
  dataByKey,
  keyExtractor,
  renderItem,
  track,
  previewGeometryByKey,
  rowStartOffset,
  viewportHeight,
}: Pick<
  ScenePagerListProps<Row>,
  | 'dataByKey'
  | 'keyExtractor'
  | 'renderItem'
  | 'previewGeometryByKey'
  | 'rowStartOffset'
> & {
  track: ScenePagerTrack;
  viewportHeight: number;
}) {
  const { key: previewKey, offset } = React.useContext(PreviewKeyContext);
  if (!previewKey) {
    return null;
  }
  const rows = dataByKey[previewKey] ?? [];
  const geometry = previewGeometryByKey?.[previewKey];
  const window =
    geometry && geometry.rowHeights.length === rows.length
      ? calculateScenePagerPreviewWindow({
          ...geometry,
          rowStartOffset,
          sourceScrollOffset: offset,
          viewportHeight,
          maxRows: PREVIEW_ROW_LIMIT,
        })
      : null;
  // Opted-in callers must not present an unknown prefix as an exact window.
  if (previewGeometryByKey && (!window || window.status !== 'resolved')) {
    return null;
  }
  const startIndex = window?.status === 'resolved' ? window.startIndex : 0;
  const endIndex =
    window?.status === 'resolved'
      ? window.endIndexExclusive
      : PREVIEW_ROW_LIMIT;
  const previewOffset =
    window?.status === 'resolved' ? window.previewOffset : 0;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.preview, { marginTop: previewOffset }]}
      testID="scene-pager-preview">
      <ScenePagerItem pageKey={previewKey} track={track}>
        {rows.slice(startIndex, endIndex).map((item, localIndex) => (
          <React.Fragment
            key={
              keyExtractor?.(item, startIndex + localIndex) ??
              startIndex + localIndex
            }>
            {renderItem({
              item,
              index: startIndex + localIndex,
              separators: previewSeparators,
            })}
          </React.Fragment>
        ))}
      </ScenePagerItem>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { position: 'absolute', left: 0, right: 0, top: '100%' },
});
