import { useEffect } from 'react';
import { Alert } from 'react-native';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import DeviceUtils from '@/core/utils/device';

/**
 * @description Prevents the user from taking a screenshot,
 * call this hook on top of your App
 */
export function usePreventScreenshot(prevent = true) {
  useEffect(() => {
    if (!prevent) {
      RNScreenshotPrevent.togglePreventScreenshot(false);
      return;
    }

    RNScreenshotPrevent.togglePreventScreenshot(true);

    return () => {
      RNScreenshotPrevent.togglePreventScreenshot(false);
    };
  }, [prevent]);
}

export function useSubscribeUserTookScreenShotOnIOS() {
  useEffect(() => {
    if (!DeviceUtils.isIOS()) return;

    const { remove } = RNScreenshotPrevent.iosOnUserDidTakeScreenshot(() => {
      // alert user
      console.debug('User took screenshot');
      Alert.alert(
        'Screenshot taken',
        `You have taken a screenshot, notice data security.`,
      );
    });

    return () => {
      remove();
    };
  }, []);
}
