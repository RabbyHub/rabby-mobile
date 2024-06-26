import React from 'react';

import { AppSwitch, SwitchToggleType } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useWhitelist } from '@/hooks/whitelist';
import { useTranslation } from 'react-i18next';

export const SwitchWhitelistEnable = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch>
>((props, ref) => {
  const { enable, toggleWhitelist } = useWhitelist();
  const colors = useThemeColors();
  const { t } = useTranslation();

  const handleWhitelistEnableChange = async (value: boolean) => {
    await toggleWhitelist(value);
  };

  React.useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      await handleWhitelistEnableChange(enabled ?? !enable);
    },
  }));

  return (
    <AppSwitch
      {...props}
      circleSize={20}
      value={!!enable}
      changeValueImmediately={false}
      onValueChange={() => {
        handleWhitelistEnableChange(!enable);
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
});
