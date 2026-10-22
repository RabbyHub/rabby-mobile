import React, { useCallback, useMemo } from 'react';
import { type ListRenderItem, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { SceneList, type SceneListProps } from './SceneList';
import { ScenePager, ScenePagerItem, type ScenePagerTrack } from './ScenePager';

const PREVIEW_ROW_LIMIT = 10;
const PreviewKeyContext = React.createContext<string | null>(null);
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
      {(track, previewKey) => (
        <PreviewKeyContext.Provider value={previewKey}>
          <PagerListContent {...props} track={track} />
        </PreviewKeyContext.Provider>
      )}
    </ScenePager>
  );
}

function PagerListContentComponent<Row>({
  dataByKey,
  keys: _keys,
  onBoundary: _onBoundary,
  onIndexChange: _onIndexChange,
  rowStartOffset: _rowStartOffset,
  scrollOffset: _scrollOffset,
  ListHeaderComponent,
  keyExtractor,
  renderItem,
  tabKey,
  track,
  ...listProps
}: ScenePagerListProps<Row> & { track: ScenePagerTrack }) {
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
        />
      </View>
    ),
    [dataByKey, headerContent, keyExtractor, renderItem, track],
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
}: Pick<
  ScenePagerListProps<Row>,
  'dataByKey' | 'keyExtractor' | 'renderItem'
> & {
  track: ScenePagerTrack;
}) {
  const previewKey = React.useContext(PreviewKeyContext);
  if (!previewKey) {
    return null;
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.preview}
      testID="scene-pager-preview">
      <ScenePagerItem pageKey={previewKey} track={track}>
        {(dataByKey[previewKey] ?? [])
          .slice(0, PREVIEW_ROW_LIMIT)
          .map((item, index) => (
            <React.Fragment key={keyExtractor?.(item, index) ?? index}>
              {renderItem({ item, index, separators: previewSeparators })}
            </React.Fragment>
          ))}
      </ScenePagerItem>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { position: 'absolute', left: 0, right: 0, top: '100%' },
});
