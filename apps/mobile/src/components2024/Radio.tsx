import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { CheckBox, CheckBoxProps } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const getStyles = createGetStyles2024(ctx => {
  return StyleSheet.create({
    icon: {
      width: 20,
      height: 20,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 100,
      backgroundColor: ctx.colors2024['brand-default'],
    },
    container: {
      flex: 1,
      marginLeft: 0,
      marginRight: 0,
      backgroundColor: 'transparent',
    },
  });
});

export const Radio: React.FC<
  CheckBoxProps & {
    iconStyle?: StyleProp<ViewStyle>;
  }
> = ({ children, iconStyle, ...props }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const getIcon = React.useCallback(
    (checked: boolean) => {
      return (
        <View style={StyleSheet.flatten([styles.icon, iconStyle])}>
          {checked && <View style={styles.dot} />}
        </View>
      );
    },
    [iconStyle, styles.dot, styles.icon],
  );

  return (
    <CheckBox
      checkedIcon={getIcon(true)}
      uncheckedIcon={getIcon(false)}
      {...props}
      containerStyle={StyleSheet.flatten([
        styles.container,
        props.containerStyle,
      ])}
    />
  );
};
