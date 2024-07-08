import React, { useCallback } from 'react';

import { AppSwitch, SwitchToggleType } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useAllowScreenshot } from '@/hooks/appSettings';

export const SwitchAllowScreenshot = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch>
>((props, ref) => {
  const { allowScreenshot, setAllowScreenshot } = useAllowScreenshot();
  const colors = useThemeColors();

  const handleToggle = useCallback(
    (value?: boolean) => {
      setAllowScreenshot(prev => value ?? !prev);
    },
    [setAllowScreenshot],
  );

  React.useImperativeHandle(ref, () => ({
    toggle: (enabled?: boolean) => {
      handleToggle(enabled);
    },
  }));

  return (
    <AppSwitch
      {...props}
      circleSize={20}
      value={!!allowScreenshot}
      changeValueImmediately={false}
      onValueChange={() => {
        handleToggle(!allowScreenshot);
      }}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
});
