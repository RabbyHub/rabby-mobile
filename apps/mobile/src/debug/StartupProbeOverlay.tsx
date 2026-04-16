import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Typography';
import { STARTUP_PROBE_ENABLED, useStartupProbeSnapshot } from './startupProbe';

function getProbeAccentColor(
  flags: ReturnType<typeof useStartupProbeSnapshot>['flags'],
) {
  if (!flags.splashHideCalled) {
    return '#FF8A00';
  }

  if (!flags.appRootLayout) {
    return '#00C853';
  }

  if (!flags.appNavigationReady) {
    return '#1565C0';
  }

  if (!flags.unlockLayout) {
    return '#8E24AA';
  }

  return '#2E7D32';
}

function formatFlag(bool: boolean) {
  return bool ? '1' : '0';
}

export function StartupProbeOverlay() {
  const snapshot = useStartupProbeSnapshot();

  if (!STARTUP_PROBE_ENABLED || !snapshot.enabled) {
    return null;
  }

  const accentColor = getProbeAccentColor(snapshot.flags);
  const lastEventLabel = snapshot.lastEvent
    ? `${snapshot.lastEvent.elapsedMs}ms ${snapshot.lastEvent.stage}`
    : 'waiting';

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={[styles.card, { borderColor: accentColor }]}>
        <Text style={styles.title}>startup probe</Text>
        <Text style={styles.line}>{lastEventLabel}</Text>
        {!!snapshot.lastEvent?.summary && (
          <Text numberOfLines={2} style={styles.lineMuted}>
            {snapshot.lastEvent.summary}
          </Text>
        )}
        <Text style={styles.lineMuted}>
          {`js:${formatFlag(snapshot.flags.jsEntryLoaded)} app:${formatFlag(
            snapshot.flags.appMounted,
          )} root:${formatFlag(snapshot.flags.appRootLayout)} boot:${formatFlag(
            snapshot.flags.bootstrapStarted,
          )} cr:${formatFlag(snapshot.flags.bootstrapCouldRender)}`}
        </Text>
        <Text style={styles.lineMuted}>
          {`nav:${formatFlag(snapshot.flags.appNavigationMounted)}/${formatFlag(
            snapshot.flags.appNavigationReady,
          )} hide:${formatFlag(
            snapshot.flags.splashHideCalled,
          )} unlock:${formatFlag(snapshot.flags.unlockMounted)}/${formatFlag(
            snapshot.flags.unlockLayout,
          )}/${formatFlag(snapshot.flags.unlockFocused)}`}
        </Text>
        {snapshot.events.slice(-4).map(event => (
          <Text key={event.id} numberOfLines={1} style={styles.eventLine}>
            {`${event.elapsedMs} ${event.stage}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 36,
    left: 8,
    right: 8,
    zIndex: 100000,
    elevation: 100000,
  },
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  line: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  lineMuted: {
    color: '#D7D7D7',
    fontSize: 10,
    marginTop: 2,
  },
  eventLine: {
    color: '#9AD1FF',
    fontSize: 10,
    marginTop: 2,
  },
});
