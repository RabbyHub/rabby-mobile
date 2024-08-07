import { ThemeColors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface SignalProps {
  color?: 'orange' | 'gray' | 'green';
  size?: 'small' | 'normal';
  isBadge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Signal: React.FC<SignalProps> = ({
  color = 'green',
  size = 'normal',
  isBadge,
  style,
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        styles[color],
        styles[size],
        isBadge && styles.isBadge,
        style,
      ]}
    />
  );
};

const getStyle = createGetStyles(colors => ({
  container: {
    borderRadius: 99,
    borderColor: colors['neutral-title-2'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  orange: {
    backgroundColor: colors['orange-default'],
  },
  gray: {
    backgroundColor: ThemeColors.light['neutral-line'],
  },
  green: {
    backgroundColor: colors['green-default'],
  },
  small: {
    width: 6,
    height: 6,
  },
  normal: {
    width: 10,
    height: 10,
  },

  isBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
}));
