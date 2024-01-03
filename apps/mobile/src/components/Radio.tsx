import { CheckBox, CheckBoxProps } from '@rneui/themed';
import React from 'react';
import CheckSVG from '@/assets/icons/assets/check.svg';
import { useThemeColors } from '@/hooks/theme';
import { StyleSheet, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    icon: {
      backgroundColor: colors['blue-default'],
      width: 24,
      height: 24,
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

export const Radio: React.FC<CheckBoxProps> = ({ children, ...props }) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const getIcon = React.useCallback(
    (bgColor: string) => {
      return (
        <View
          style={[
            styles.icon,
            {
              backgroundColor: bgColor,
            },
          ]}>
          <CheckSVG />
        </View>
      );
    },
    [styles],
  );

  return (
    <CheckBox
      containerStyle={styles.container}
      checkedIcon={getIcon(colors['blue-default'])}
      uncheckedIcon={getIcon(colors['neutral-line'])}
      {...props}
    />
  );
};
