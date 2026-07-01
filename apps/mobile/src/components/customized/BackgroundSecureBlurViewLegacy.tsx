import React from 'react';
import { BlurView } from '@react-native-community/blur';

import { RootNames } from '@/constant/layout';
import { useCurrentRouteName } from '@/hooks/navigation';
import { useIOSAppSwitcherBlurVisible } from '@/hooks/native/security';
import { useGetBinaryMode, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

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

export function BackgroundSecureBlurViewLegacy() {
  const { styles } = useThemeStyles(getBlurModalStyles);
  const appThemeMode = useGetBinaryMode();
  const { currentRouteName } = useCurrentRouteName();
  const visible = useIOSAppSwitcherBlurVisible();

  if (!visible) {
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
