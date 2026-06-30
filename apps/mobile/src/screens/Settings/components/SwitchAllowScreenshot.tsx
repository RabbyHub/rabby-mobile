import React, { useImperativeHandle, useCallback } from 'react';

import { AppSwitch, SwitchToggleRefProp } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useForceAllowScreenshot } from '@/hooks/appSettings';
import { IS_IOS } from '@/core/native/utils';
import { Alert } from 'react-native';

export const SwitchAllowScreenshot = ({
  ref,
  ...props
}: React.ComponentProps<typeof AppSwitch> & SwitchToggleRefProp) => {
  const { forceAllowScreenshot, setAllowScreenshot } =
    useForceAllowScreenshot();
  const colors = useThemeColors();

  const handleToggle = useCallback(
    (value?: boolean) => {
      setAllowScreenshot(prev => value ?? !prev);
      if (IS_IOS) {
        Alert.alert(
          'Restart required',
          'Please restart the app for the changes to take effect',
        );
      }
    },
    [setAllowScreenshot],
  );

  useImperativeHandle(ref, () => ({
    toggle: (enabled?: boolean) => {
      handleToggle(enabled);
    },
  }));

  return (
    <AppSwitch
      {...props}
      value={!!forceAllowScreenshot}
      changeValueImmediately={false}
      onValueChange={() => {
        handleToggle(!forceAllowScreenshot);
      }}
      circleSize={20}
      backgroundActive={colors['green-default']}
      circleBorderActiveColor={colors['green-default']}
    />
  );
};
