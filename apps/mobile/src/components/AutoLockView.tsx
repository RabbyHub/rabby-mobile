import React from 'react';
import { Keyboard, PanResponder, View, ViewProps } from 'react-native';

import * as apisAutoLock from '@/core/apis/autoLock';
import { getLatestNavigationName } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { bindKeyringEvent } from '@/core/serviceApi/keyring';
import { throttle } from 'lodash';
import { autoLockEvent } from '@/core/apis/autoLock';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import type {
  AsName,
  MakePropsByAsMap} from '@/hooks/common/useComponentAsProp';
import {
  useComponentByAsProp,
} from '@/hooks/common/useComponentAsProp';
import { perfEvents } from '@/core/utils/perf';

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

const ViewMap = {
  View,
  BottomSheetView,
};

type Props<A extends AsName<typeof ViewMap>> = MakePropsByAsMap<
  typeof ViewMap,
  A
>;
export default function AutoLockView<
  T extends AsName<typeof ViewMap> = 'View',
>({ as = 'View' as T, ...props }: Props<T>) {
  const { panResponder } = useRefreshAutoLockPanResponder();

  const { Component: ViewComp } = useComponentByAsProp(as, ViewMap);

  return (
    <ViewComp {...props} {...panResponder.panHandlers}>
      {props.children || null}
    </ViewComp>
  );
}

function ForAppNav(props: Props<'View'>) {
  React.useEffect(() => {
    const subUnlock = perfEvents.subscribe(
      'WALLET_AUTH_UNLOCKED',
      apisAutoLock.handleUnlock,
    );
    let removeKeyringLockListener: null | (() => void) = null;
    let effectDisposed = false;
    void bindKeyringEvent('lock', apisAutoLock.handleLock).then(remove => {
      if (effectDisposed) {
        remove();
        return;
      }
      removeKeyringLockListener = remove;
    });

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
      effectDisposed = true;
      subUnlock.remove();
      removeKeyringLockListener?.();

      hideEvent.remove();
      showEvent.remove();
    };
  }, []);

  return <AutoLockView {...props} />;
}

AutoLockView.ForAppNav = ForAppNav;
