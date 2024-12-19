import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import LinearGradient from 'react-native-linear-gradient';

export const LoadingLinear = () => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.linear}
      colors={[colors2024['neutral-bg-2'], colors2024['neutral-bg-1']]}
    />
  );
};

const getStyle = createGetStyles2024(() => ({
  linear: {
    height: '100%',
  },
}));
