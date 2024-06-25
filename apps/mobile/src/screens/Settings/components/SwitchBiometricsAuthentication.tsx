import { AppSwitch } from '@/components';
import { useBiometrics } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';

export const SwitchBiometricsAuthentication = () => {
  const { biometrics, requestToggleBiometricsEnabled } = useBiometrics();
  const { hasSetupCustomPassword } = useWalletPasswordInfo();
  const colors = useThemeColors();

  return (
    <AppSwitch
      disabled={!hasSetupCustomPassword || !biometrics.supportedBiometryType}
      value={!!biometrics.authEnabled}
      changeValueImmediately={false}
      onValueChange={requestToggleBiometricsEnabled}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
