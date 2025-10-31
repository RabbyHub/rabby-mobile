import React from 'react';

import {
  AppSwitch2024,
  SwitchToggleType,
} from '@/components/customized/Switch2024';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useToggleShowAutoLockCountdown } from '@/hooks/appSettings';

export const SwitchShowFloatingAutoLockCountdown = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch2024>
>((props, ref) => {
  const { showAutoLockCountdown, toggleShowAutoLockCountdown } =
    useToggleShowAutoLockCountdown();
  const colors = useThemeColors();
  const { t } = useTranslation();

  React.useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      toggleShowAutoLockCountdown(enabled ?? !showAutoLockCountdown);
    },
  }));

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      value={!!showAutoLockCountdown}
      changeValueImmediately={false}
      onValueChange={() => {
        toggleShowAutoLockCountdown();
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
});
