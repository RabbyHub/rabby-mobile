import React, { type Ref, useImperativeHandle } from 'react';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { SwitchToggleType } from '@/components';
import { useBiometrics } from '@/hooks/biometrics';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { useTranslation } from 'react-i18next';

function useToggleBiometricsEnabled() {
  const { computed, toggleBiometrics } = useBiometrics();
  const { t } = useTranslation();

  const requestToggleBiometricsEnabled = React.useCallback(
    async (
      nextEnabled: boolean,
      onToggleSuccess?: (enabled: boolean) => void | Promise<void>,
    ) => {
      AuthenticationModal.show({
        confirmText: t('global.confirm'),
        cancelText: t('global.cancel'),
        title: nextEnabled
          ? t('component.AuthenticationModals.biometrics.enable', {
              bioType: computed.defaultTypeLabel,
            })
          : t('component.AuthenticationModals.biometrics.disable', {
              bioType: computed.defaultTypeLabel,
            }),
        // description: nextEnabled
        //   ? t('component.AuthenticationModals.biometrics.enableTip', {
        //       bioType: computed.defaultTypeLabel,
        //     })
        //   : t('component.AuthenticationModals.biometrics.disableTip', {
        //       bioType: computed.defaultTypeLabel,
        //     }),
        authType: nextEnabled ? ['password'] : ['none'],
        async onFinished({ getValidatedPassword }) {
          const changed = await toggleBiometrics(nextEnabled, {
            validatedPassword: getValidatedPassword(),
            // tipLoading: true,
          });
          if (changed) {
            await onToggleSuccess?.(nextEnabled);
          }
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggleBiometrics, computed.defaultTypeLabel],
  );

  return {
    isBiometricsEnabled: computed.isBiometricsEnabled,
    couldSetupBiometrics: computed.couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  };
}

export const SwitchBiometricsAuthentication = ({
  ref,
  onToggleSuccess,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & {
  onToggleSuccess?: (enabled: boolean) => void | Promise<void>;
  ref?: Ref<SwitchToggleType>;
}) => {
  const {
    isBiometricsEnabled,
    couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  } = useToggleBiometricsEnabled();

  useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      await requestToggleBiometricsEnabled(
        enabled ?? !isBiometricsEnabled,
        onToggleSuccess,
      );
    },
  }));

  const { hasSetupCustomPassword } = useWalletPasswordInfo();

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      disabled={!hasSetupCustomPassword || !couldSetupBiometrics}
      value={!!isBiometricsEnabled}
      changeValueImmediately={false}
      onValueChange={enabled => {
        requestToggleBiometricsEnabled(enabled, onToggleSuccess);
      }}
    />
  );
};
