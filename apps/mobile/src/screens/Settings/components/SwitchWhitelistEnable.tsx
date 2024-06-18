import { AppSwitch } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { useTranslation } from 'react-i18next';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';

export const SwitchWhitelistEnable = () => {
  const { enable, toggleWhitelist } = useWhitelist();
  const colors = useThemeColors();
  const { t } = useTranslation();

  const handleWhitelistEnableChange = async (value: boolean) => {
    await AuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('page.dashboard.settings.cancel'),
      title: value
        ? t('page.dashboard.settings.enableWhitelist')
        : t('page.dashboard.settings.disableWhitelist'),
      description: value
        ? t('page.dashboard.settings.enableWhitelistTip')
        : t('page.dashboard.settings.disableWhitelistTip'),
      validationHandler: async (password: string) => {
        return apisLock.throwErrorIfInvalidPwd(password);
      },
      onFinished() {
        toggleWhitelist(value);
      },
    });
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
