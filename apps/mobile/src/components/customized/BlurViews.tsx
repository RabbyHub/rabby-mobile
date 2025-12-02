import React from 'react';
import { BlurView, BlurViewProps } from '@react-native-community/blur';

import { useGetBinaryMode, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useIsOnBackground } from '@/hooks/useLock';
import { useCurrentRouteName } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { View } from 'react-native';

const getBlurModalStyles = createGetStyles(colors => {
  return {
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    },

    iosView: {
      backgroundColor: colors['neutral-bg-1'],
    },
  };
});

const BLUR_FREE_ROOT_NAMES = [RootNames.Unlock] as const;

export function BackgroundSecureBlurView() {
  const { styles } = useThemeStyles(getBlurModalStyles);

  const appThemeMode = useGetBinaryMode();

  const { currentRouteName } = useCurrentRouteName();
  const { isOnBackground } = useIsOnBackground();

  if (!isOnBackground || IS_ANDROID) return null;
  if (
    currentRouteName &&
    BLUR_FREE_ROOT_NAMES.includes(currentRouteName as any)
  )
    return null;

  // if (IS_IOS) {
  //   return <View style={[styles.container, styles.iosView]} />;
  // }

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
