import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, ViewProps } from 'react-native';

export const GasAccountWrapperBg = ({
  children,
  style,
  ...others
}: ViewProps) => {
  const { styles } = useTheme2024({
    getStyle,
  });
  return (
    <View {...others} style={[styles.container, style]}>
      {children}
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    position: 'relative',
  },
}));
