import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated as NativeAnimated,
  type ListRenderItem,
  StyleSheet,
  View,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { CollapsibleSceneProvider } from '@rabby-wallet/rn-collapsible-scene-view';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Text } from '@/components/Typography';
import {
  RetainedScenePagerList,
  type RetainedScenePagerListHandle,
} from '@/components/RetainedScenePagerList/RetainedScenePagerList';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const KEYS = ['Positions', 'Orders', 'Account'];
const HEADER_HEIGHT = 368;
const TAB_HEIGHT = 48;
const PAGE_STYLES = Object.fromEntries(KEYS.map(key => [key, {}]));
type Quote = { revision: number };
type Row = { key: string; height: number };
type PageEvidence = {
  rowMounts: number;
  rowUnmounts: number;
  rowRenders: number;
};
const selectRevision = (state: Quote) => state.revision;

function makeRows(count: number, page: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${page}-${index + 1}`,
    height: 72 + (index % 3) * 16,
  }));
}

/** Fixtures for the same retained list used by the business screen.
 * Native layout measures rows; no alternate pager protocol or fixed heights.
 */
export default function DevUIRetainedTabs({ onBack }: { onBack: () => void }) {
  const [activeKey, setActiveKey] = useState(KEYS[0]);
  const [short, setShort] = useState(false);
  const [extra, setExtra] = useState(0);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState('');
  const [tradeCount, setTradeCount] = useState(0);
  const listRef = useRef<RetainedScenePagerListHandle>(null);
  const nativeY = useRef(new NativeAnimated.Value(0)).current;
  const scrollOffset = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);
  const gestureActive = useSharedValue(false);
  const store = useMemo(() => createStore<Quote>(() => ({ revision: 0 })), []);
  const evidence = useMemo<PageEvidence[]>(
    () => KEYS.map(() => ({ rowMounts: 0, rowUnmounts: 0, rowRenders: 0 })),
    [],
  );
  const rows = useMemo(
    () => [
      makeRows(120, 0),
      makeRows(80 + extra, 1),
      makeRows(short ? 4 : 100, 2),
    ],
    [extra, short],
  );
  const dataByKey = useMemo(
    () => Object.fromEntries(KEYS.map((key, index) => [key, rows[index]])),
    [rows],
  );
  const renderItemByKey = useMemo(
    () =>
      Object.fromEntries(
        KEYS.map((key, index) => [
          key,
          (({ item }) => (
            <FixtureRow
              row={item}
              index={index}
              store={store}
              evidence={evidence[index]}
            />
          )) satisfies ListRenderItem<Row>,
        ]),
      ),
    [evidence, store],
  );

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(
      () => store.setState(state => ({ revision: state.revision + 1 })),
      100,
    );
    return () => clearInterval(timer);
  }, [running, store]);

  const chooseTab = useCallback(
    (key: string) => listRef.current?.selectTab(key),
    [],
  );
  const commitTab = useCallback(
    (key: string) =>
      setActiveKey(previous => (previous === key ? previous : key)),
    [],
  );
  const snapshot = () =>
    setReport(
      JSON.stringify({
        selected: activeKey,
        source: store.getState().revision,
        pages: KEYS.map((key, index) => ({
          key,
          fixtureRows: rows[index].length,
          ...evidence[index],
        })),
      }),
    );
  const header = useMemo(
    () => (
      <View testID="retained-header">
        <View style={styles.header}>
          <Text>Header / Market</Text>
        </View>
        <View style={styles.trade}>
          <Text>Trade — native vertical content</Text>
          <Pressable
            testID="retained-trade"
            onPress={() => setTradeCount(count => count + 1)}>
            <Text>Trade button: {tradeCount}</Text>
          </Pressable>
        </View>
        <View style={{ height: TAB_HEIGHT }} />
      </View>
    ),
    [tradeCount],
  );

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Pressable onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable onPress={() => listRef.current?.scrollToOffset(4000, false)}>
          <Text>Deep</Text>
        </Pressable>
        <Pressable onPress={() => listRef.current?.scrollToOffset(0, false)}>
          <Text>Top</Text>
        </Pressable>
        <Pressable onPress={() => setShort(value => !value)}>
          <Text>{short ? 'Short C' : 'Long C'}</Text>
        </Pressable>
        <Pressable onPress={() => setExtra(value => value + 3)}>
          <Text>+3 B</Text>
        </Pressable>
        <Pressable onPress={() => setRunning(value => !value)}>
          <Text>{running ? 'Stop' : 'Feed'}</Text>
        </Pressable>
        <Pressable onPress={snapshot}>
          <Text>Inspect</Text>
        </Pressable>
      </View>
      <Text testID="retained-selection">Retained native tabs: {activeKey}</Text>
      <Text numberOfLines={4} style={styles.report} testID="retained-report">
        {report}
      </Text>
      <View style={styles.body}>
        <CollapsibleSceneProvider
          activeTab={activeKey}
          tabs={KEYS}
          headerHeight={HEADER_HEIGHT - TAB_HEIGHT}
          scrollOffset={scrollOffset}
          syncOffsetOnActivate={false}>
          <RetainedScenePagerList
            ref={listRef}
            activeKey={activeKey}
            keys={KEYS}
            identityKey="retained-fixture"
            activityEnabled
            dataByKey={dataByKey}
            renderItemByKey={renderItemByKey}
            pageStyleByKey={PAGE_STYLES}
            listHeader={header}
            rowStartOffset={HEADER_HEIGHT}
            pinnedHeight={TAB_HEIGHT}
            scrollOffset={scrollOffset}
            indicatorPosition={indicatorPosition}
            gestureActive={gestureActive}
            onTabChange={commitTab}
            nativeScrollY={nativeY}
            style={styles.body}
            testID="retained"
          />
        </CollapsibleSceneProvider>
        <NativeAnimated.View
          style={[
            styles.tabs,
            {
              transform: [
                {
                  translateY: nativeY.interpolate({
                    inputRange: [0, HEADER_HEIGHT - TAB_HEIGHT],
                    outputRange: [HEADER_HEIGHT - TAB_HEIGHT, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}>
          {KEYS.map((key, index) => (
            <Pressable
              key={key}
              testID={`retained-tab-${index}`}
              onPress={() => chooseTab(key)}
              style={[styles.tab, activeKey === key && styles.selected]}>
              <Text>{key}</Text>
            </Pressable>
          ))}
        </NativeAnimated.View>
      </View>
    </View>
  );
}

const FixtureRow = memo(function FixtureRow({
  row,
  index,
  store,
  evidence,
}: {
  row: Row;
  index: number;
  store: StoreApi<Quote>;
  evidence: PageEvidence;
}) {
  const revision = useActivityStore(store, selectRevision);
  evidence.rowRenders++;
  useEffect(() => {
    evidence.rowMounts++;
    return () => {
      evidence.rowUnmounts++;
    };
  }, [evidence]);
  return (
    <View
      style={[
        styles.row,
        {
          height: row.height,
          backgroundColor: ['#eaf2ff', '#e9f9ef', '#fff0df'][index],
        },
      ]}
      testID={`retained-row-${row.key}`}>
      <Text>
        {KEYS[index]} / {row.key} — tick {revision}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 80 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  report: { fontSize: 10, height: 52 },
  body: { flex: 1 },
  header: {
    height: 120,
    backgroundColor: '#e8f0ff',
    justifyContent: 'center',
    padding: 16,
  },
  trade: {
    height: 200,
    backgroundColor: '#f6f6f7',
    justifyContent: 'center',
    gap: 24,
    padding: 16,
  },
  tabs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: TAB_HEIGHT,
    backgroundColor: '#fff',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#a8ceff' },
  row: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});
