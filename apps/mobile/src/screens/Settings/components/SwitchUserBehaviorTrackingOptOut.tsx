import React, {
  type Ref,
  useCallback,
  useImperativeHandle,
  useSyncExternalStore,
} from 'react';

import {
  AppSwitch2024,
  SwitchToggleType,
} from '@/components/customized/Switch2024';
import { preferenceService } from '@/core/services';
import { perfEvents } from '@/core/utils/perf';
import { useThemeColors } from '@/hooks/theme';
import { USER_BEHAVIOR_TRACKING_OPT_OUT_KEY } from '@/utils/trackingOptOut';

function subscribeUserBehaviorTrackingOptOut(onStoreChange: () => void) {
  const subscription = perfEvents.subscribe('PREFERENCE_UPDATED', ({ key }) => {
    if (key === USER_BEHAVIOR_TRACKING_OPT_OUT_KEY) {
      onStoreChange();
    }
  });

  return () => {
    subscription.remove();
  };
}

function getUserBehaviorTrackingOptOutSnapshot() {
  return preferenceService.getUserBehaviorTrackingOptOut();
}

export const SwitchUserBehaviorTrackingOptOut = ({
  ref,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & {
  ref?: Ref<SwitchToggleType>;
}) => {
  const optOut = useSyncExternalStore(
    subscribeUserBehaviorTrackingOptOut,
    getUserBehaviorTrackingOptOutSnapshot,
    getUserBehaviorTrackingOptOutSnapshot,
  );
  const colors = useThemeColors();

  const setOptOut = useCallback((enabled?: boolean) => {
    preferenceService.setUserBehaviorTrackingOptOut(
      typeof enabled === 'boolean'
        ? enabled
        : !preferenceService.getUserBehaviorTrackingOptOut(),
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      toggle: async (enabled?: boolean) => {
        setOptOut(enabled ?? !optOut);
      },
    }),
    [optOut, setOptOut],
  );

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      value={!!optOut}
      changeValueImmediately={false}
      onValueChange={setOptOut}
      backgroundActive={colors['red-default']}
      circleBorderActiveColor={colors['red-default']}
    />
  );
};
