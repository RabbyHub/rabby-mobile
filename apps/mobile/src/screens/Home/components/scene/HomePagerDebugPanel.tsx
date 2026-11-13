import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/Typography';
import { isNonPublicProductionEnv } from '@/constant';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { apisHomeTabIndex, useHomeTabIndex } from '@/hooks/navigation';

import {
  getHomePagerDebugSnapshot,
  readHomePagerDebugLive,
  resetHomePagerDebug,
  setHomePagerDebugPanelEnabled,
  subscribeHomePagerDebug,
  useToggleHomePagerDebugPanel,
} from './homePagerDiagnostics';

const MAX_ROWS = 11;

/**
 * Home first-floor pager diagnostics. Display-only body (touches pass through
 * to the pager); only the header row is interactive so Richard can swipe while
 * the panel is open.
 */
export function HomePagerDebugPanel() {
  const { showHomePagerDebugPanel } = useToggleHomePagerDebugPanel();
  const { tabIndex } = useHomeTabIndex();
  const { safeTop } = useSafeSizes();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState(getHomePagerDebugSnapshot);
  const [live, setLive] = React.useState(readHomePagerDebugLive);

  React.useEffect(() => {
    if (!showHomePagerDebugPanel) {
      return undefined;
    }
    const unsubscribe = subscribeHomePagerDebug(() => {
      setSnapshot(getHomePagerDebugSnapshot());
    });
    const timer = setInterval(() => {
      setSnapshot(getHomePagerDebugSnapshot());
      setLive(readHomePagerDebugLive());
    }, 200);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [showHomePagerDebugPanel]);

  if (!isNonPublicProductionEnv || !showHomePagerDebugPanel) {
    return null;
  }

  const track = Number.isFinite(live.track) ? live.track.toFixed(2) : '--';
  const svIndex = apisHomeTabIndex.svTabIndexDecimal.value;
  const svName = apisHomeTabIndex.svTabName.value;
  const { counters } = snapshot;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { top: safeTop + 96, width: width - 24 }]}>
      <View style={styles.panel} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable hitSlop={8} onPress={() => setCollapsed(value => !value)}>
            <Text style={styles.title}>
              HP {collapsed ? '▸' : '▾'} track {track}
            </Text>
          </Pressable>
          <Text style={styles.sub} numberOfLines={1}>
            {live.gesturing ? 'GESTURE' : 'idle'} · {svName}(
            {svIndex.toFixed(2)}) · store {tabIndex}
          </Text>
          <Pressable hitSlop={8} onPress={resetHomePagerDebug}>
            <Text style={styles.reset}>reset</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => setHomePagerDebugPanelEnabled(false)}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        {collapsed ? null : (
          <View pointerEvents="none">
            <Text style={styles.counters} numberOfLines={1}>
              settles {counters.settles} · commits {counters.commits} · skip{' '}
              {counters.skipped} · ign-jump {counters.ignoredJumps} · back{' '}
              {counters.backwards}
            </Text>
            {snapshot.events.slice(0, MAX_ROWS).map(event => (
              <Text
                key={event.id}
                numberOfLines={1}
                style={[
                  styles.event,
                  event.kind === 'commit' && styles.eventCommit,
                  event.kind === 'jump-ignored' && styles.eventWarn,
                  event.kind === 'settle' && styles.eventSettle,
                ]}>
                {event.text}
              </Text>
            ))}
            {snapshot.events.length === 0 ? (
              <Text style={styles.event}>swipe to populate…</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    left: 12,
    position: 'absolute',
    zIndex: 9999,
  },
  panel: {
    backgroundColor: 'rgba(12, 14, 20, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#8CE99A',
    fontSize: 11,
    fontWeight: '600',
  },
  sub: {
    color: '#DEE2E6',
    flexShrink: 1,
    fontSize: 10,
    marginHorizontal: 8,
  },
  reset: {
    color: '#FFA94D',
    fontSize: 10,
    fontWeight: '600',
  },
  close: {
    color: '#DEE2E6',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  counters: {
    color: '#CED4DA',
    fontSize: 10,
    marginBottom: 3,
    marginTop: 4,
  },
  event: {
    color: '#ADB5BD',
    fontFamily: 'Menlo',
    fontSize: 9,
    lineHeight: 12,
  },
  eventSettle: {
    color: '#74C0FC',
  },
  eventCommit: {
    color: '#B2F2BB',
  },
  eventWarn: {
    color: '#FFA94D',
  },
});
