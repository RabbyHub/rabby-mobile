import React from 'react';

import { TextStyle, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { DEFAULT_NAVBAR_FONT_SIZE } from '@/constant/layout';

export default function HeaderTitleText({
  style,
  children,
}: React.PropsWithChildren<{
  style?: TextStyle;
}>) {
  const colors = useThemeColors();

  return (
    <Text
      style={[
        {
          color: colors['neutral-title-1'],
          fontSize: DEFAULT_NAVBAR_FONT_SIZE,
        },
        styles.text,
        style,
      ]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '500',
  },
});
