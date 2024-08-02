import React from 'react';

import { AppSwitch, SwitchToggleType } from '@/components';
import { useBiometrics } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { strings } from '@/utils/i18n';

function useToggleBiometricsEnabled() {
  const { computed, toggleBiometrics } = useBiometrics();

  const requestToggleBiometricsEnabled = React.useCallback(
    async (nextEnabled: boolean) => {
      AuthenticationModal.show({
        confirmText: strings('global.confirm'),
        cancelText: strings('global.cancel'),
        title: nextEnabled
          ? strings('component.AuthenticationModals.biometrics.enable', {
              bioType: computed.defaultTypeLabel,
            })
          : strings('component.AuthenticationModals.biometrics.disable', {
              bioType: computed.defaultTypeLabel,
            }),
        // description: nextEnabled
        //   ? strings('component.AuthenticationModals.biometrics.enableTip', {
        //       bioType: computed.defaultTypeLabel,
        //     })
        //   : strings('component.AuthenticationModals.biometrics.disableTip', {
        //       bioType: computed.defaultTypeLabel,
        //     }),
        authType: nextEnabled ? ['password'] : ['none'],
        async onFinished({ getValidatedPassword }) {
          await toggleBiometrics(nextEnabled, {
            validatedPassword: getValidatedPassword(),
            // tipLoading: true,
          });
        },
      });
    },
    [toggleBiometrics, computed.defaultTypeLabel],
  );

  return {
    isBiometricsEnabled: computed.isBiometricsEnabled,
    couldSetupBiometrics: computed.couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  };
}

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
