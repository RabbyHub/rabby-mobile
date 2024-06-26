import { AppSwitch } from '@/components';
import { useToggleBiometricsEnabled } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';
import { useWalletPasswordInfo } from '@/screens/ManagePassword/useManagePassword';

export const SwitchBiometricsAuthentication = (
  props: React.ComponentProps<typeof AppSwitch>,
) => {
  const {
    isBiometricsEnabled,
    couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  } = useToggleBiometricsEnabled();
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
};
