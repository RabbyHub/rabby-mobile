import React from 'react';
import { Keyboard, PanResponder, View, ViewProps } from 'react-native';

import { apisAutoLock } from '@/core/apis';
import { getLatestNavigationName } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import {
  requestLockWalletAndBackToUnlockScreen,
  useCurrentRouteName,
} from '@/hooks/navigation';
import { keyringService } from '@/core/services';
import { throttle } from 'lodash';
import { autoLockEvent } from '@/core/apis/autoLock';

const refreshTimeout = throttle(
  () => {
    const routeName = getLatestNavigationName();
    if (routeName === RootNames.Unlock) return;

    return apisAutoLock.refreshAutolockTimeout();
  },
  250 * 3,
  { leading: true },
);

function useAutoLockIfTimeout(currentRouteName: string | null) {
  React.useEffect(() => {
    if (currentRouteName === RootNames.Unlock) return;

    const handler: Parameters<
      typeof autoLockEvent.addListener<'timeout'>
    >[1] = ctx => {
      const routeName = getLatestNavigationName();

      const hasBeenUnlock = routeName === RootNames.Unlock;
      if (!hasBeenUnlock) {
        requestLockWalletAndBackToUnlockScreen();
      } else {
        ctx.delayLock();
      }
    };
    autoLockEvent.addListener('timeout', handler);

    return () => {
      autoLockEvent.removeListener('timeout', handler);
    };
  }, [currentRouteName]);
}

export function useRefreshAutoLockPanResponder() {
  return React.useMemo(() => {
    /**
     * In order not to steal any touches from the children components, this method
     * must return false.
     */
    const resetTimerForPanResponder = () => {
      refreshTimeout();
      return false;
    };

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: resetTimerForPanResponder,
      onPanResponderTerminationRequest: resetTimerForPanResponder,
      onStartShouldSetPanResponderCapture: resetTimerForPanResponder,
    });

    return {
      panResponder,
    };
  }, []);
}

export default function AutoLockView(props: ViewProps) {
  const { currentRouteName } = useCurrentRouteName();
  useAutoLockIfTimeout(currentRouteName ?? null);
  const { panResponder } = useRefreshAutoLockPanResponder();

  React.useEffect(() => {
    keyringService.on('unlock', apisAutoLock.handleUnlock);
    keyringService.on('lock', apisAutoLock.handleLock);

    const hideEvent = Keyboard.addListener('keyboardDidHide', refreshTimeout);
    const showEvent = Keyboard.addListener('keyboardDidShow', refreshTimeout);

    // release event listeners on destruction
    return () => {
      keyringService.off('unlock', apisAutoLock.handleUnlock);
      keyringService.off('lock', apisAutoLock.handleLock);

      hideEvent.remove();
      showEvent.remove();
    };
  }, []);

  return <View {...props} {...panResponder.panHandlers} />;
}
