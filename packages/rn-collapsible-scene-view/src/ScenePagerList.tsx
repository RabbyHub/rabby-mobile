import React, { useCallback, useMemo } from 'react';
import { type ListRenderItem, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { SceneList, type SceneListProps } from './SceneList';
import { ScenePager, ScenePagerItem, type ScenePagerTrack } from './ScenePager';

const PREVIEW_ROW_LIMIT = 10;
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
  return (
    <ScenePager
      activeKey={props.tabKey}
      keys={props.keys}
      onBoundary={props.onBoundary}
      onIndexChange={props.onIndexChange}
      rowRegion={{
        startOffset: props.rowStartOffset,
        scrollOffset: props.scrollOffset,
      }}
      testID={props.testID ? `${props.testID}-pager` : undefined}>
      {track => <PagerListContent {...props} track={track} />}
    </ScenePager>
  );
}

function PagerListContent<Row>({
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
  const header = useMemo(() => {
    const previewKey = track.previewKey;
    const Header = ListHeaderComponent;
    return (
      <View>
        {React.isValidElement(Header) ? Header : Header ? <Header /> : null}
        {previewKey ? (
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
        ) : null}
      </View>
    );
  }, [ListHeaderComponent, dataByKey, keyExtractor, renderItem, track]);
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

const styles = StyleSheet.create({
  preview: { position: 'absolute', left: 0, right: 0, top: '100%' },
});
