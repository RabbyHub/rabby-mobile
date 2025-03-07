import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { Switch, SwitchProps } from 'react-native-switch';

export const AppSwitch2024 = React.forwardRef<Switch, SwitchProps>(
  (props, ref) => {
    const { colors2024 } = useTheme2024();

    return (
      <Switch
        circleSize={22}
        renderActiveText={false}
        renderInActiveText={false}
        circleActiveColor={colors2024['neutral-bg-1']}
        circleInActiveColor={colors2024['neutral-bg-1']}
        backgroundActive={colors2024['brand-default']}
        backgroundInactive={colors2024['neutral-line']}
        barHeight={24}
        circleBorderWidth={2}
        circleBorderActiveColor={colors2024['brand-default']}
        circleBorderInactiveColor={colors2024['neutral-line']}
        {...props}
        ref={ref}
      />
    );
  },
);

export type SwitchToggleType = {
  toggle: (enabled?: boolean) => void;
};
