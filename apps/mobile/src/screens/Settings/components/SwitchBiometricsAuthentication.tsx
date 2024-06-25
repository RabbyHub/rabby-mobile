import { AppSwitch } from '@/components';
import { useBiometricsInfo } from '@/hooks/biometrics';
import { useThemeColors } from '@/hooks/theme';

export const SwitchBiometricsAuthentication = () => {
  const { biometrics, requestToggleBiometricsEnabled } = useBiometricsInfo();
  const colors = useThemeColors();

  return (
    <AppSwitch
      value={!!biometrics.authEnabled}
      changeValueImmediately={false}
      onValueChange={requestToggleBiometricsEnabled}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
