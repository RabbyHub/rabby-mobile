import React, { useImperativeHandle } from 'react';

import {
  AppSwitch2024,
  SwitchToggleRefProp,
} from '@/components/customized/Switch2024';
import { useThemeColors } from '@/hooks/theme';
import {
  useToggleShowAutoLockCountdown,
  useToggleShowUnlockStatusBar,
} from '@/hooks/appSettings';

export const SwitchShowFloatingAutoLockCountdown = ({
  ref,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & SwitchToggleRefProp) => {
  const { showAutoLockCountdown, toggleShowAutoLockCountdown } =
    useToggleShowAutoLockCountdown();
  const colors = useThemeColors();

  useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      toggleShowAutoLockCountdown(enabled ?? !showAutoLockCountdown);
    },
  }));

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      value={!!showAutoLockCountdown}
      changeValueImmediately={false}
      onValueChange={() => {
        toggleShowAutoLockCountdown();
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};

export const SwitchShowFloatingUnlockStatusBar = ({
  ref,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & SwitchToggleRefProp) => {
  const { showUnlockStatusBar, toggleShowUnlockStatusBar } =
    useToggleShowUnlockStatusBar();
  const colors = useThemeColors();

  useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      toggleShowUnlockStatusBar(enabled ?? !showUnlockStatusBar);
    },
  }));

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      value={!!showUnlockStatusBar}
      changeValueImmediately={false}
      onValueChange={() => {
        toggleShowUnlockStatusBar();
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
