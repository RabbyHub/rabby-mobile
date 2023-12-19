import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ButtonProps, Button } from '../Button';

export const FooterButton: React.FC<ButtonProps> = props => {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        footer: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 0.5,
          borderTopColor: colors['neutral-line'],
          backgroundColor: 'white',
          padding: 20,
        },
        button: {
          backgroundColor: colors['blue-default'],
          height: 52,
          borderRadius: 8,
        },
        buttonText: {
          color: colors['neutral-title-2'],
        },
      }),

    [colors],
  );

  return (
    <View style={styles.footer}>
      <Button
        buttonStyle={styles.button}
        titleStyle={styles.buttonText}
        {...props}
      />
    </View>
  );
};
