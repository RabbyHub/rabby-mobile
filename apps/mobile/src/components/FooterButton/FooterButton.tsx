import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ButtonProps, Button } from '../Button';

export const FooterButton: React.FC<
  ButtonProps & {
    width?: number;
    footerStyle?: StyleProp<ViewStyle>;
  }
> = props => {
  const colors = useThemeColors();
  const { width, footerStyle } = props;
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        footer: {
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors['neutral-line'],
          backgroundColor: colors['neutral-bg-1'],
          padding: 20,
          paddingBottom: 35,
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
        buttonShadow: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          // box-shadow: 0px 4px 16px 0px rgba(112, 132, 255, 0.30);
          shadowColor: colors['blue-default'],
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 4,
        },
      }),
    [colors],
  );

  return (
    <View
      style={[
        styles.footer,
        footerStyle,
        width
          ? // eslint-disable-next-line react-native/no-inline-styles
            {
              alignItems: 'center',
            }
          : {},
      ]}>
      <View>
        {!props.disabled && (
          <View style={[styles.buttonShadow, styles.button]} />
        )}
        <Button
          buttonStyle={[styles.button, { width }]}
          titleStyle={styles.buttonText}
          disabledTitleStyle={styles.disabledTitle}
          {...props}
        />
      </View>
      {props.children}
    </View>
  );
};
