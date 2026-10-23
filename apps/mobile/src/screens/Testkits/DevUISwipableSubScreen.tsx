import {
  CollapsibleSceneProvider,
  ScenePagerList,
  useCollapsibleSceneController,
} from '@rabby-wallet/rn-collapsible-scene-view';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Text } from '@/components/Typography';

type PlaygroundTab = 'a' | 'b' | 'c';

const TABS: PlaygroundTab[] = ['a', 'b', 'c'];

const ROWS: Record<
  PlaygroundTab,
  { key: string; label: string; height: number }[]
> = {
  a: Array.from({ length: 40 }, (_, i) => ({
    key: `a-${i}`,
    label: `A row ${i + 1}`,
    height: 64 + (i % 3) * 24,
  })),
  b: Array.from({ length: 24 }, (_, i) => ({
    key: `b-${i}`,
    label: `B row ${i + 1}`,
    height: 80 + (i % 2) * 32,
  })),
  c: Array.from({ length: 5 }, (_, i) => ({
    key: `c-${i}`,
    label: `C row ${i + 1}`,
    height: 64,
  })),
};

// This fixture owns exact heights; business cards must supply measured extents
// before opting into the same window contract.
const PREVIEW_GEOMETRY = Object.fromEntries(
  TABS.map(key => [key, { rowHeights: ROWS[key].map(row => row.height) }]),
);

/**
 * Isolated one-list row pager, without business state or persistence.
 */
export default function DevUISwipableSubScreen() {
  const [tab, setTab] = useState<PlaygroundTab>('a');
  const [boundary, setBoundary] = useState<string>('none');
  const controller = useCollapsibleSceneController();
  const rows = ROWS[tab];

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Header / market</Text>
          <Text testID="dev-perps-pager-active">
            active={tab} rows={rows.length}
          </Text>
          <Text testID="dev-perps-pager-boundary">boundary={boundary}</Text>
        </View>
        <View style={styles.tradeBlock}>
          <Text style={styles.title}>Trade block (list header)</Text>
          <Text>Drag here: it must scroll natively with the rows.</Text>
        </View>
        <View style={styles.tabBar}>
          {TABS.map(item => (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[styles.tab, item === tab ? styles.tabActive : null]}
              testID={`dev-perps-pager-tab-${item}`}>
              <Text>{item.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [boundary, rows.length, tab],
  );

  return (
    <View style={styles.container}>
      <CollapsibleSceneProvider
        activeTab={tab}
        controller={controller}
        headerHeight={0}
        syncOffsetOnActivate={false}
        tabs={TABS}>
        <ScenePagerList
          ListHeaderComponent={listHeader}
          contentInsetTop={0}
          dataByKey={ROWS}
          previewGeometryByKey={PREVIEW_GEOMETRY}
          keys={TABS}
          onBoundary={setBoundary}
          onIndexChange={key => setTab(key as PlaygroundTab)}
          rowStartOffset={368}
          scrollOffset={controller.scrollY}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <View
              style={[styles.row, { height: item.height }]}
              testID={`dev-perps-pager-row-${item.key}`}>
              <Text>{item.label}</Text>
            </View>
          )}
          tabKey={tab}
          testID="dev-perps-pager-scroll"
        />
      </CollapsibleSceneProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flex: 1, paddingTop: 80 },
  headerBlock: {
    backgroundColor: '#e8f0ff',
    height: 120,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  row: {
    borderBottomColor: '#eee',
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: '#dbe7ff' },
  tabBar: { flexDirection: 'row', height: 48 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  tradeBlock: {
    backgroundColor: '#f6f6f7',
    height: 200,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
