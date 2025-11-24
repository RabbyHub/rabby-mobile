import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { RabbySwitch, SwitchProps } from '@/components/Switch/Switch';

export const AppSwitch2024 = React.forwardRef<RabbySwitch, SwitchProps>(
  (props, ref) => {
    const { colors2024 } = useTheme2024();

    return (
      <RabbySwitch
        circleSize={22}
        renderActiveText={false}
        renderInActiveText={false}
        circleActiveColor="rgba(255, 255, 255, 1)"
        circleInActiveColor="rgba(255, 255, 255, 1)"
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
