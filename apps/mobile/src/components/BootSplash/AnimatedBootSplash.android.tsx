import BootSplash from '@rabby-wallet/react-native-bootsplash';
import React from 'react';

import { perfEvents } from '@/core/utils/perf';
import { navigationRef } from '@/utils/navigation';

const SPLASH_EXIT_FALLBACK_MS = 8000;

export function AnimatedBootSplash() {
  React.useEffect(() => {
    let hideRequested = false;

    const hideNativeSplash = () => {
      if (hideRequested) {
        return;
      }

      hideRequested = true;
      BootSplash.hide({ fade: false }).catch(error => {
        console.error('AnimatedBootSplash::hideNativeSplash::error', error);
      });
    };

    const navigationReadySub = perfEvents.subscribe(
      'APP_NAVIGATION_READY',
      hideNativeSplash,
    );
    const exitFallback = setTimeout(hideNativeSplash, SPLASH_EXIT_FALLBACK_MS);

    if (navigationRef.isReady()) {
      hideNativeSplash();
    }

    return () => {
      navigationReadySub.remove();
      clearTimeout(exitFallback);
    };
  }, []);

  return null;
}
