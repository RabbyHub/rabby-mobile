import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export const PlaceholderView = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <LinearGradient
      style={styles.root}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 0 }}
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flex: 1,
    height: 34,
    borderRadius: 100,
  },
}));
