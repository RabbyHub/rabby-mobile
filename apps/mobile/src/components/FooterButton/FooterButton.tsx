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
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors['neutral-line'],
          backgroundColor: colors['neutral-bg-1'],
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
        disabledTitle: {
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
        disabledTitleStyle={styles.disabledTitle}
        {...props}
      />
    </View>
  );
};
