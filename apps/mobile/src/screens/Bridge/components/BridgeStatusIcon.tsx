import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Pending from '@/assets2024/icons/bridge/IconPendingCC.svg';
import Success from '@/assets2024/icons/bridge/IconSelectCC.svg';
import Failed from '@/assets2024/icons/bridge/IconFailedCC.svg';
import Queued from '@/assets2024/icons/bridge/IconQueueCC.svg';
import Refund from '@/assets2024/icons/bridge/IconRefund.svg';
import type { BridgePopupStep } from '../utils/progressBar';

export function BridgeStatusIcon({
  status,
  size = 16,
  enabled = true,
}: {
  status: BridgePopupStep;
  size?: number;
  enabled?: boolean;
}) {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const rotation = useRef(new Animated.Value(0)).current;
  const spinning = status === 'processing' || status === 'pending';
  useEffect(() => {
    if (!spinning || !enabled) {
      return;
    }
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spinning, enabled, rotation]);
  const color =
    status === 'processing'
      ? colors2024['brand-default']
      : status === 'pending'
      ? colors2024['orange-default']
      : status === 'completed'
      ? colors2024['green-default']
      : status === 'failed'
      ? colors2024['red-default']
      : colors2024['neutral-title-1'];
  if (status === 'refund') {
    return (
      <View
        style={[
          styles.refund,
          {
            width: size,
            height: size,
            transform: [{ scaleX: -1 }],
          },
        ]}>
        <Refund color={color} />
      </View>
    );
  }
  if (spinning) {
    return (
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}>
        <Pending width={size} height={size} color={color} />
      </Animated.View>
    );
  }
  const Icon =
    status === 'completed' ? Success : status === 'failed' ? Failed : Queued;
  return (
    <Icon
      width={size}
      height={size}
      color={status === 'queued' ? colors2024['neutral-foot'] : color}
    />
  );
}

const getStyle = createGetStyles2024(() => ({
  refund: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
