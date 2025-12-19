import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { RabbySwitch, SwitchProps } from '@/components/Switch/Switch';

export const AppSwitch = React.forwardRef<RabbySwitch, SwitchProps>(
  (props, ref) => {
    const colors = useThemeColors();
    return (
      <RabbySwitch
        circleSize={18}
        renderActiveText={false}
        renderInActiveText={false}
        circleActiveColor={colors['neutral-title-2']}
        circleInActiveColor={colors['neutral-title-2']}
        backgroundActive={colors['blue-default']}
        backgroundInactive={colors['neutral-line']}
        circleBorderWidth={1}
        circleBorderActiveColor={colors['blue-default']}
        circleBorderInactiveColor={colors['neutral-line']}
        {...props}
        ref={ref}
      />
    );
  },
);

export type SwitchToggleType = {
  toggle: (enabled?: boolean) => void;
};
