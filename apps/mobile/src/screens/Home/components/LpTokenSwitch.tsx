import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { AppSwitch2024 } from '@/components/customized/Switch2024';

const LpTokenSwitch: React.FC<{
  isEnabled: boolean;
  onValueChange?: (value: boolean) => void;
  size?: number;
}> = ({ isEnabled, onValueChange, size = 18 }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={styles.container}>
      <AppSwitch2024
        value={isEnabled}
        barHeight={size}
        circleSize={size}
        backgroundActive={colors2024['green-default']}
        circleBorderActiveColor={colors2024['green-default']}
        onValueChange={onValueChange}
      />
      <Text style={styles.text}>LP-Token</Text>
    </View>
  );
};

export default LpTokenSwitch;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
}));
