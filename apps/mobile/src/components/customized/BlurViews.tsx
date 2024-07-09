import React from 'react';
import { BlurView, BlurViewProps } from '@react-native-community/blur';

import { useGetBinaryMode, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useIsOnBackground } from '@/hooks/useLock';

const getBlurModalStyles = createGetStyles(colors => {
  return {
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    },
  };
});

export function BackgroundSecureBlurView() {
  const { styles } = useThemeStyles(getBlurModalStyles);

  const appThemeMode = useGetBinaryMode();

  const { isOnBackground } = useIsOnBackground();

  if (!isOnBackground) return null;

  return (
    <BlurView
      style={styles.container}
      blurType={appThemeMode ?? 'light'}
      blurAmount={10}>
      {/* <Text>Modal with blur background</Text> */}
    </BlurView>
  );
}

export function SafeTipModalBlurView() {
  const { styles } = useThemeStyles(getBlurModalStyles);

  const appThemeMode = useGetBinaryMode();

  const { isOnBackground } = useIsOnBackground();

  if (!isOnBackground) return null;

  return (
    <BlurView
      style={styles.container}
      blurType={appThemeMode ?? 'light'}
      blurAmount={10}>
      {/* <Text>Modal with blur background</Text> */}
    </BlurView>
  );
}
