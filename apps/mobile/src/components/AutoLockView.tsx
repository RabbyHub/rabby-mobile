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
import { BottomSheetView } from '@gorhom/bottom-sheet';

const implUiRefreshTimeout = throttle(
  () => {
    const routeName = getLatestNavigationName();
    if (routeName === RootNames.Unlock) return;

    // if (__DEV__) console.debug('uiRefreshTimeout');

    return apisAutoLock.refreshAutolockTimeout();
  },
  250 * 3,
  { leading: true },
);
autoLockEvent.addListener('triggerRefresh', implUiRefreshTimeout);

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
      implUiRefreshTimeout();
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

type ViewAsMap = {
  View: typeof View;
  BottomSheetView: typeof BottomSheetView;
};
export type NativeViewAs = keyof ViewAsMap;

export function getViewComponentByAs<T extends NativeViewAs>(
  as: T = 'View' as T,
) {
  switch (as) {
    case 'BottomSheetView':
      return BottomSheetView;
    case 'View':
    default:
      return View;
  }
}

type Props<T extends NativeViewAs> = {
  as?: T;
} & React.ComponentProps<ViewAsMap[T]>;
export default function AutoLockView<T extends NativeViewAs = 'View'>({
  as = 'View' as T,
  ...props
}: Props<T>) {
  const { panResponder } = useRefreshAutoLockPanResponder();

  const ViewComp = React.useMemo(() => getViewComponentByAs(as), [as]);

  return (
    <ViewComp {...props} {...panResponder.panHandlers}>
      {props.children || null}
    </ViewComp>
  );
}

function ForAppNav(props: Props<'View'>) {
  const { currentRouteName } = useCurrentRouteName();
  useAutoLockIfTimeout(currentRouteName ?? null);

  React.useEffect(() => {
    keyringService.on('unlock', apisAutoLock.handleUnlock);
    keyringService.on('lock', apisAutoLock.handleLock);

    const hideEvent = Keyboard.addListener(
      'keyboardDidHide',
      implUiRefreshTimeout,
    );
    const showEvent = Keyboard.addListener(
      'keyboardDidShow',
      implUiRefreshTimeout,
    );

    // release event listeners on destruction
    return () => {
      keyringService.off('unlock', apisAutoLock.handleUnlock);
      keyringService.off('lock', apisAutoLock.handleLock);

      hideEvent.remove();
      showEvent.remove();
    };
  }, []);

  return <AutoLockView {...props} />;
}

AutoLockView.ForAppNav = ForAppNav;
