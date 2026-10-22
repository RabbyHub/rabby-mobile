import {
  CollapsibleSceneProvider,
  SceneList,
  useCollapsibleSceneController,
} from '@rabby-wallet/rn-collapsible-scene-view';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PlaygroundTab = 'a' | 'b' | 'c';

const TABS: PlaygroundTab[] = ['a', 'b', 'c'];

const ROWS: Record<PlaygroundTab, { key: string; label: string }[]> = {
  a: Array.from({ length: 12 }, (_, i) => ({
    key: `a-${i}`,
    label: `A row ${i + 1}`,
  })),
  b: Array.from({ length: 8 }, (_, i) => ({
    key: `b-${i}`,
    label: `B row ${i + 1}`,
  })),
  c: Array.from({ length: 5 }, (_, i) => ({
    key: `c-${i}`,
    label: `C row ${i + 1}`,
  })),
};

/**
 * Isolated harness for the single-list + header tab swap. It intentionally
 * has no app state, persistence or pager: tapping a tab only changes the
 * SceneList `data` prop, so a mismatch here is a component-level bug.
 */
export default function DevUISwipableSubScreen() {
  const [tab, setTab] = useState<PlaygroundTab>('a');
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
    [rows.length, tab],
  );

  return (
    <View style={styles.container}>
      <CollapsibleSceneProvider
        activeTab={tab}
        controller={controller}
        headerHeight={0}
        tabs={TABS}>
        <SceneList
          ListHeaderComponent={listHeader}
          contentInsetTop={0}
          data={rows}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`dev-perps-pager-row-${item.key}`}>
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
    height: 64,
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
