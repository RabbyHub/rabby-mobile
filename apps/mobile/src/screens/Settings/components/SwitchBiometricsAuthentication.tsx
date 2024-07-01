import React from 'react';

import { AppSwitch, SwitchToggleType } from '@/components';
import { useToggleBiometricsEnabled } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';

export const SwitchBiometricsAuthentication = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch>
>((props, ref) => {
  const {
    isBiometricsEnabled,
    couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  } = useToggleBiometricsEnabled();

  React.useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      await requestToggleBiometricsEnabled(enabled ?? !isBiometricsEnabled);
    },
  }));

  const { hasSetupCustomPassword } = useWalletPasswordInfo();
  const colors = useThemeColors();

  return (
    <AppSwitch
      {...props}
      circleSize={20}
      disabled={!hasSetupCustomPassword || !couldSetupBiometrics}
      value={!!isBiometricsEnabled}
      changeValueImmediately={false}
      onValueChange={requestToggleBiometricsEnabled}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
});
