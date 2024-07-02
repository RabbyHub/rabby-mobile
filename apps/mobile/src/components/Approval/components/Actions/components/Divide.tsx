import { AppColorsVariants } from '@/constant/theme';
import { useThemeStyles } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    div: {
      height: 0.5,
      backgroundColor: colors['neutral-card-2'],
      width: '100%',
    },
  });

export const Divide: React.FC<any> = ({ style, ...props }) => {
  const { styles } = useThemeStyles(getStyle);

  return <View style={StyleSheet.flatten([styles.div, style])} {...props} />;
};
