import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Loading from '@/assets2024/icons/swap/loading-cc.svg';
import Refresh from '@/assets2024/icons/bridge/IconRefreshCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

/** Same icon/native rotation as CircleSpinnerCC; no visible loading copy. */
export function PerpsSimpleChartLoading({
  busy,
  hasData,
  onRetry,
}: {
  busy: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const rotation = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(!hasData || !busy);
  useEffect(() => {
    setVisible(!hasData || !busy);
    if (!hasData || !busy) return;
    // Keep fast cached switches free of a one-frame spinner flash.
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [hasData, busy]);
  useEffect(() => {
    if (!busy || !visible) return;
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      rotation.setValue(0);
    };
  }, [busy, visible, rotation]);
  if (!visible) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, hasData && styles.retained]}>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        accessibilityLabel={t(
          `page.perps.pro.common.${busy ? 'loading' : 'retry'}`,
        )}>
        {busy ? (
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
            <Loading
              width={24}
              height={24}
              color={colors2024['neutral-secondary']}
            />
          </Animated.View>
        ) : (
          <Refresh
            width={24}
            height={24}
            color={colors2024['neutral-secondary']}
          />
        )}
      </Pressable>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retained: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors2024['neutral-bg-1'],
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
