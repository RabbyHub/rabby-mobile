import React from 'react';

import {Text, StyleSheet} from 'react-native';
import {useThemeColors} from '@/hooks/theme';

export default function HeaderTitleText({
  style,
  children,
}: React.PropsWithChildren<{
  style?: React.ComponentProps<typeof Text>;
}>) {
  const colors = useThemeColors();

  return (
    <Text
      style={[
        {
          color: colors['neutral-title-1'],
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
