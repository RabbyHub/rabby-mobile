import React from 'react';
import { BlurView } from '@react-native-community/blur';

import { useGetBinaryMode, useThemeStyles } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { useCurrentRouteName } from '@/hooks/navigation';
import { useIOSAppSwitcherBlurVisible } from '@/hooks/native/security';
import { createGetStyles } from '@/utils/styles';
import { useIsOnBackground } from '@/hooks/useLock';
import { IS_ANDROID } from '@/core/native/utils';

const getBlurModalStyles = createGetStyles(() => {
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
  const { currentRouteName } = useCurrentRouteName();
  const visible = useIOSAppSwitcherBlurVisible();

  if (!visible || IS_ANDROID) {
    return null;
  }

  if (currentRouteName === RootNames.Unlock) {
    return null;
  }

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

  if (!isOnBackground) {
    return null;
  }

  return (
    <BlurView
      style={styles.container}
      blurType={appThemeMode ?? 'light'}
      blurAmount={10}>
      {/* <Text>Modal with blur background</Text> */}
    </BlurView>
  );
}
