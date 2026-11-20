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
const EMPTY_ROWS: readonly never[] = [];
// The header's preview slot consumes neighbour updates without invalidating
// the active list's data, renderer or ListHeaderComponent identity.
const PreviewContext = React.createContext<React.ReactNode>(null);
const previewSeparators = {
  highlight: () => undefined,
  unhighlight: () => undefined,
  updateProps: () => undefined,
};

export type ScenePagerListProps<Row> = Omit<SceneListProps<Row>, 'data'> & {
  dataByKey: Readonly<Record<string, readonly Row[]>>;
  /** Optional per-page renderers; renderItem remains the default for any key. */
  renderItemByKey?: Readonly<Record<string, ListRenderItem<Row>>>;
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
  const {
    dataByKey,
    keys,
    onBoundary,
    onIndexChange,
    onLayout,
    previewGeometryByKey,
    renderItem,
    renderItemByKey,
    rowStartOffset,
    scrollOffset,
    ...listProps
  } = props;
  const [viewportHeight, setViewportHeight] = useState(0);
  const requiresGeometry = !!previewGeometryByKey;
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (requiresGeometry) {
        setViewportHeight(event.nativeEvent.layout.height);
      }
      onLayout?.(event);
    },
    [onLayout, requiresGeometry],
  );
  const rowRegion = useMemo(
    () => ({ startOffset: rowStartOffset, scrollOffset }),
    [rowStartOffset, scrollOffset],
  );
  return (
    <ScenePager
      activeKey={props.tabKey}
      keys={keys}
      onBoundary={onBoundary}
      onIndexChange={onIndexChange}
      rowRegion={rowRegion}
      testID={props.testID ? `${props.testID}-pager` : undefined}>
      {(track, previewKey, previewScrollOffset) => (
        <PagerListPreviewProvider
          data={previewKey ? dataByKey[previewKey] ?? EMPTY_ROWS : EMPTY_ROWS}
          geometry={previewKey ? previewGeometryByKey?.[previewKey] : undefined}
          keyExtractor={listProps.keyExtractor}
          previewKey={previewKey}
          offset={previewScrollOffset}
          renderItem={
            (previewKey && renderItemByKey?.[previewKey]) || renderItem
          }
          requiresGeometry={requiresGeometry}
          rowStartOffset={rowStartOffset}
          track={track}
          viewportHeight={viewportHeight}>
          <PagerListContent
            {...listProps}
            data={dataByKey[props.tabKey] ?? EMPTY_ROWS}
            onLayout={handleLayout}
            renderItem={renderItemByKey?.[props.tabKey] ?? renderItem}
            track={track}
          />
        </PagerListPreviewProvider>
      )}
    </ScenePager>
  );
}

type PagerListPreviewProps<Row> = Pick<
  SceneListProps<Row>,
  'data' | 'keyExtractor' | 'renderItem'
> & {
  geometry?: NonNullable<
    ScenePagerListProps<Row>['previewGeometryByKey']
  >[string];
  offset: number;
  previewKey: string | null;
  requiresGeometry: boolean;
  rowStartOffset: number;
  track: ScenePagerTrack;
  viewportHeight: number;
};

function PagerListPreviewProvider<Row>({
  children,
  data,
  geometry,
  keyExtractor,
  previewKey,
  offset,
  renderItem,
  requiresGeometry,
  rowStartOffset,
  track,
  viewportHeight,
}: React.PropsWithChildren<PagerListPreviewProps<Row>>) {
  const value = useMemo(
    () =>
      previewKey ? (
        <PagerListPreview
          data={data}
          geometry={geometry}
          keyExtractor={keyExtractor}
          offset={offset}
          previewKey={previewKey}
          renderItem={renderItem}
          requiresGeometry={requiresGeometry}
          rowStartOffset={rowStartOffset}
          track={track}
          viewportHeight={viewportHeight}
        />
      ) : null,
    [
      data,
      geometry,
      keyExtractor,
      offset,
      previewKey,
      renderItem,
      requiresGeometry,
      rowStartOffset,
      track,
      viewportHeight,
    ],
  );
  return (
    <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
  );
}

function PagerListPreviewSlot() {
  return React.useContext(PreviewContext);
}

function PagerListContentComponent<Row>({
  ListHeaderComponent,
  renderItem,
  tabKey,
  track,
  ...listProps
}: SceneListProps<Row> & { track: ScenePagerTrack }) {
  const Header = ListHeaderComponent;
  const headerContent = useMemo(
    () => (React.isValidElement(Header) ? Header : Header ? <Header /> : null),
    [Header],
  );
  const header = useMemo(
    () => (
      <View>
        {headerContent}
        <PagerListPreviewSlot />
      </View>
    ),
    [headerContent],
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
  data: rows,
  geometry,
  keyExtractor,
  offset,
  previewKey,
  renderItem,
  requiresGeometry,
  track,
  rowStartOffset,
  viewportHeight,
}: PagerListPreviewProps<Row>) {
  if (!previewKey) {
    return null;
  }
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
  if (requiresGeometry && (!window || window.status !== 'resolved')) {
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
