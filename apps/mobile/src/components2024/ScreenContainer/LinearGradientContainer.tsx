import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import React from 'react';

import { StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface Props {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const LinearGradientContainer: React.FC<Props> = ({
  style,
  children,
}) => {
  const { colors2024 } = useTheme2024();
  const isDarkTheme = useGetBinaryMode() === 'dark';

  return (
    <LinearGradient
      style={style}
      colors={
        isDarkTheme
          ? [colors2024['neutral-bg-3'], colors2024['neutral-bg-3']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]
      }>
      {children}
    </LinearGradient>
  );
};
