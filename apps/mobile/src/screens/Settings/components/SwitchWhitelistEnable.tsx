import { AppSwitch } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { useTranslation } from 'react-i18next';

export const SwitchWhitelistEnable = () => {
  const { enable, toggleWhitelist } = useWhitelist();
  const colors = useThemeColors();
  const { t } = useTranslation();

  const handleWhitelistEnableChange = async (value: boolean) => {
    await toggleWhitelist(value);
  };

  return (
    <AppSwitch
      value={!!enable}
      changeValueImmediately={false}
      onValueChange={() => {
        handleWhitelistEnableChange(!enable);
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
