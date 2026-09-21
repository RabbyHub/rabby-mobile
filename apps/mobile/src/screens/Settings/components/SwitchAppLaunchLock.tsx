import React, {
  type Ref,
  useCallback,
  useImperativeHandle,
  useSyncExternalStore,
} from 'react';

import {
  AppSwitch2024,
  type SwitchToggleType,
} from '@/components/customized/Switch2024';
import {
  appLaunchLockEvent,
  isAppLaunchLockEnabled,
  setAppLaunchLockEnabled,
} from '@/core/apis/lock';

function subscribeAppLaunchLock(onStoreChange: () => void) {
  const listener = () => onStoreChange();
  appLaunchLockEvent.addListener('changed', listener);

  return () => {
    appLaunchLockEvent.off('changed', listener);
  };
}

export const SwitchAppLaunchLock = ({
  ref,
  onBeforeToggle,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & {
  ref?: Ref<SwitchToggleType>;
  onBeforeToggle?: (nextEnabled: boolean) => boolean;
}) => {
  const enabled = useSyncExternalStore(
    subscribeAppLaunchLock,
    isAppLaunchLockEnabled,
    isAppLaunchLockEnabled,
  );

  const toggle = useCallback(
    (nextEnabled = !enabled) => {
      if (onBeforeToggle && !onBeforeToggle(nextEnabled)) {
        return;
      }

      try {
        setAppLaunchLockEnabled(nextEnabled);
      } catch (error) {
        // persisting failed, keep the switch on its previous position
        console.error('setAppLaunchLockEnabled failed', error);
      }
    },
    [enabled, onBeforeToggle],
  );

  useImperativeHandle(ref, () => ({ toggle }), [toggle]);

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      changeValueImmediately={false}
      value={enabled}
      onValueChange={toggle}
    />
  );
};
