import { AppSwitch } from '@/components';
import { useBiometrics, useToggleBiometricsEnabled } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';

export const SwitchBiometricsAuthentication = () => {
  const {
    isBiometricsEnabled,
    couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  } = useToggleBiometricsEnabled();
  const { hasSetupCustomPassword } = useWalletPasswordInfo();
  const colors = useThemeColors();

  return (
    <AppSwitch
      disabled={!hasSetupCustomPassword || !couldSetupBiometrics}
      value={!!isBiometricsEnabled}
      changeValueImmediately={false}
      onValueChange={requestToggleBiometricsEnabled}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
