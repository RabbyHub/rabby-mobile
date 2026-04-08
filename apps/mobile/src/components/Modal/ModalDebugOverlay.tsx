import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Typography';
import {
  useModalGateDebugOverlayEnabled,
  useVisibleBlockingModalIds,
} from '@/utils/modalGate';

export function ModalDebugOverlay() {
  const enabled = useModalGateDebugOverlayEnabled();

  if (!__DEV__ || !enabled) {
    return null;
  }

  return <ModalDebugOverlayContent />;
}

function ModalDebugOverlayContent() {
  const visibleModalIds = useVisibleBlockingModalIds();

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Text style={styles.title}>
        Blocking Modals ({visibleModalIds.length})
      </Text>
      <Text style={styles.body}>
        {visibleModalIds.length ? visibleModalIds.join('\n') : 'none'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 64,
    right: 12,
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 8, 14, 0.86)',
    zIndex: 99999,
  },
  title: {
    color: '#E6ECFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  body: {
    marginTop: 4,
    color: '#9FB0CC',
    fontSize: 11,
    lineHeight: 14,
  },
});
