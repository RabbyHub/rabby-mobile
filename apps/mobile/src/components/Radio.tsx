import { CheckBox, CheckBoxProps } from '@rneui/themed';
import React from 'react';
import CheckSVG from '@/assets/icons/assets/check.svg';
import { useThemeColors } from '@/hooks/theme';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    icon: {
      backgroundColor: colors['blue-default'],
      width: 16,
      height: 16,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
  });
};

export const Radio: React.FC<
  CheckBoxProps & {
    iconStyle?: StyleProp<ViewStyle>;
  }
> = ({ children, iconStyle, ...props }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const getIcon = React.useCallback(
    (bgColor: string) => {
      return (
        <View
          style={StyleSheet.flatten([
            styles.icon,
            iconStyle,
            {
              backgroundColor: bgColor,
            },
          ])}>
          <CheckSVG />
        </View>
      );
    },
    [iconStyle, styles.icon],
  );

  return (
    <CheckBox
      checkedIcon={getIcon(colors['blue-default'])}
      uncheckedIcon={getIcon(colors['neutral-line'])}
      {...props}
      containerStyle={StyleSheet.flatten([
        styles.container,
        props.containerStyle,
      ])}
    />
  );
};
