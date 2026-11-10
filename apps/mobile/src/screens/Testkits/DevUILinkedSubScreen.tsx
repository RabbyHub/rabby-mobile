import React, { useCallback, useMemo, useState } from 'react';
import { type ListRenderItem, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  calculateScenePagerPreviewWindow,
  CollapsibleSceneProvider,
  type LinkedPagerTrack,
  SceneList,
  ScenePagerGroup,
  ScenePagerGroupRow,
  ScenePagerItem,
  useCollapsibleSceneController,
  useScenePagerGroupPreview,
  useScenePagerGroupTrack,
} from '@rabby-wallet/rn-collapsible-scene-view';
import { Text } from '@/components/Typography';

const ROOT_KEYS = ['pro', 'simple'];
const TAB_KEYS = ['positions', 'openOrders', 'account'];
const PILL_KEYS = ['basic', 'conditional'];
const LEAF_KEYS = ['positions', 'basic', 'conditional', 'account'];
const HEADER_HEIGHT = 416;
const ROW_HEIGHT = 96;
type Row = { key: string; label: string };
const ROWS: Record<string, readonly Row[]> = Object.fromEntries(
  LEAF_KEYS.map(key => [
    key,
    Array.from({ length: 24 }, (_, index) => ({
      key: `${key}-${index}`,
      label: `${key} / ${index + 1}`,
    })),
  ]),
);
const rowKey = (row: Row) => row.key;

/** Synthetic presentation only: no account, subscriptions or trading actions. */
export default function DevUILinkedSubScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const [root, setRoot] = useState('pro');
  const [tab, setTab] = useState('positions');
  const [pill, setPill] = useState('basic');
  const controller = useCollapsibleSceneController();
  const tracks = useMemo<LinkedPagerTrack[]>(
    () => [
      { key: 'root', keys: ROOT_KEYS, activeKey: root, startOffset: 0 },
      {
        key: 'tabs',
        keys: TAB_KEYS,
        activeKey: tab,
        parentKey: 'root',
        parentPageKey: 'pro',
        startOffset: 320,
      },
      {
        key: 'pills',
        keys: PILL_KEYS,
        activeKey: pill,
        parentKey: 'tabs',
        parentPageKey: 'openOrders',
        startOffset: HEADER_HEIGHT,
      },
    ],
    [root, tab, pill],
  );
  const changePage = useCallback((trackKey: string, pageKey: string) => {
    if (trackKey === 'root') {
      setRoot(pageKey);
    } else if (trackKey === 'tabs') {
      setTab(pageKey);
    } else if (trackKey === 'pills') {
      setPill(pageKey);
    }
  }, []);
  const leaf = tab === 'openOrders' ? pill : tab;
  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Pressable onPress={onBack} testID="linked-pager-back">
          <Text>Single level</Text>
        </Pressable>
        <Text testID="linked-pager-selection">
          {root} / {tab} / {pill}
        </Text>
      </View>
      <CollapsibleSceneProvider
        activeTab={leaf}
        controller={controller}
        headerHeight={0}
        syncOffsetOnActivate={false}
        tabs={LEAF_KEYS}>
        <ScenePagerGroup
          tracks={tracks}
          scrollOffset={controller.scrollY}
          onIndexChange={changePage}
          testID="linked-pager-group">
          <LinkedPages
            root={root}
            tab={tab}
            pill={pill}
            onTab={setTab}
            onPill={setPill}
          />
        </ScenePagerGroup>
      </CollapsibleSceneProvider>
    </View>
  );
}

function LinkedPages({
  root,
  tab,
  pill,
  onTab,
  onPill,
}: {
  root: string;
  tab: string;
  pill: string;
  onTab: (key: string) => void;
  onPill: (key: string) => void;
}) {
  const rootTrack = useScenePagerGroupTrack('root');
  const [viewportHeight, setViewportHeight] = useState(0);
  const leaf = tab === 'openOrders' ? pill : tab;
  const header = useMemo(
    () => (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Pro / Header & Market</Text>
        </View>
        <View style={styles.trade}>
          <Text style={styles.title}>Trade</Text>
        </View>
        <View style={styles.tabs}>
          {TAB_KEYS.map(key => (
            <Pressable
              key={key}
              onPress={() => onTab(key)}
              style={[styles.tab, key === tab && styles.selected]}
              testID={`linked-tab-${key}`}>
              <Text>{key}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabs}>
          {tab === 'openOrders'
            ? PILL_KEYS.map(key => (
                <Pressable
                  key={key}
                  onPress={() => onPill(key)}
                  style={[styles.tab, key === pill && styles.selected]}
                  testID={`linked-pill-${key}`}>
                  <Text>{key}</Text>
                </Pressable>
              ))
            : null}
        </View>
        <LinkedPreview tab={tab} pill={pill} viewportHeight={viewportHeight} />
      </View>
    ),
    [onPill, onTab, pill, tab, viewportHeight],
  );
  const renderRow = useCallback<ListRenderItem<Row>>(
    ({ item, index }) => (
      <ScenePagerGroupRow
        pages={
          tab === 'openOrders' ? { tabs: tab, pills: pill } : { tabs: tab }
        }
        contentBounds={{
          startOffset: HEADER_HEIGHT + index * ROW_HEIGHT,
          endOffset: HEADER_HEIGHT + (index + 1) * ROW_HEIGHT,
        }}
        overscan={ROW_HEIGHT}>
        <RowView row={item} />
      </ScenePagerGroupRow>
    ),
    [pill, tab],
  );
  return (
    <>
      <ScenePagerItem pageKey="pro" track={rootTrack} style={styles.page}>
        <View
          style={styles.flex}
          pointerEvents={root === 'pro' ? 'auto' : 'none'}
          accessibilityElementsHidden={root !== 'pro'}
          importantForAccessibility={
            root === 'pro' ? 'auto' : 'no-hide-descendants'
          }>
          <SceneList
            ListHeaderComponent={header}
            contentInsetTop={0}
            data={ROWS[leaf]}
            keyExtractor={rowKey}
            onLayout={event =>
              setViewportHeight(event.nativeEvent.layout.height)
            }
            removeClippedSubviews={false}
            renderItem={renderRow}
            scrollEnabled={root === 'pro'}
            style={styles.flex}
            tabKey={leaf}
            testID="linked-pager-list"
          />
        </View>
      </ScenePagerItem>
      <ScenePagerItem
        pageKey="simple"
        track={rootTrack}
        style={[styles.page, styles.simple]}>
        <View
          pointerEvents={root === 'simple' ? 'auto' : 'none'}
          accessibilityElementsHidden={root !== 'simple'}
          importantForAccessibility={
            root === 'simple' ? 'auto' : 'no-hide-descendants'
          }>
          <Text style={styles.title}>Simple / Independent screen</Text>
        </View>
      </ScenePagerItem>
    </>
  );
}

function RowView({ row }: { row: Row }) {
  return (
    <View style={styles.row} testID={`linked-row-${row.key}`}>
      <Text>{row.label}</Text>
    </View>
  );
}

function LinkedPreview({
  tab,
  pill,
  viewportHeight,
}: {
  tab: string;
  pill: string;
  viewportHeight: number;
}) {
  const preview = useScenePagerGroupPreview();
  const tabTrack = useScenePagerGroupTrack('tabs');
  const pillTrack = useScenePagerGroupTrack('pills');
  if (!preview || preview.trackKey === 'root') {
    return null;
  }
  const targetTab = preview.trackKey === 'tabs' ? preview.pageKey : tab;
  const targetPill = preview.trackKey === 'pills' ? preview.pageKey : pill;
  const rows = ROWS[targetTab === 'openOrders' ? targetPill : targetTab];
  const window = calculateScenePagerPreviewWindow({
    rowHeights: rows.map(() => ROW_HEIGHT),
    rowStartOffset: HEADER_HEIGHT,
    sourceScrollOffset: preview.scrollOffset,
    viewportHeight,
    maxRows: 10,
  });
  if (window.status !== 'resolved') {
    return null;
  }
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.preview, { marginTop: window.previewOffset }]}
      testID="linked-pager-preview">
      <ScenePagerItem
        pageKey={preview.pageKey}
        track={preview.trackKey === 'tabs' ? tabTrack : pillTrack}>
        {rows.slice(window.startIndex, window.endIndexExclusive).map(row => (
          <RowView key={row.key} row={row} />
        ))}
      </ScenePagerItem>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 80 },
  summary: {
    height: 56,
    paddingHorizontal: 16,
    justifyContent: 'space-evenly',
  },
  flex: { flex: 1 },
  page: { ...StyleSheet.absoluteFillObject },
  simple: {
    backgroundColor: '#ffeedd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 120,
    backgroundColor: '#e8f0ff',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  trade: {
    height: 200,
    backgroundColor: '#f6f6f7',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: { fontSize: 18, fontWeight: '600' },
  tabs: { flexDirection: 'row', height: 48 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#dbe7ff' },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  preview: { position: 'absolute', left: 0, right: 0, top: '100%' },
});
