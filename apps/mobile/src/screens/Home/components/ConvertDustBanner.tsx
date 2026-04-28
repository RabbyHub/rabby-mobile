import React, { useCallback } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { Text } from '@/components/Typography';
import { FastTouchable } from '@/components/Perf/FastTouchable';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NewTag } from './NewTag';

export function ConvertDustBanner({
  onPress,
  onClose,
}: {
  onPress: () => void;
  onClose: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  const handleClose = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return (
    <View style={styles.wrapper}>
      <FastTouchable style={styles.card} onPress={onPress}>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Convert Dust</Text>
            <NewTag />
          </View>
          <Text style={styles.desc}>
            Supports converting small balances into the native token
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={handleClose}
          style={styles.closeButton}>
          <Text style={styles.closeText}>x</Text>
        </Pressable>
      </FastTouchable>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    paddingHorizontal: 16,
  },
  card: {
    height: 100,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingLeft: 16,
    paddingRight: 44,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  desc: {
    width: 230,
    marginTop: 4,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 24,
  },
}));
