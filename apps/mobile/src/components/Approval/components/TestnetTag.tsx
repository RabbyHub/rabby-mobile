import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const TestnetTag = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => {
    return getStyles(colors);
  }, [colors]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Custom Network</Text>
    </View>
  );
};

export const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors['neutral-title-1'],
      opacity: 0.3,
      transform: [{ rotate: '-23deg' }],
    },
    text: {
      fontSize: 20,
      lineHeight: 24,
      color: colors['neutral-title-1'],
    },
  });
