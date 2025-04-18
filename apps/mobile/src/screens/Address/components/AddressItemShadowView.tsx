import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  viewBase: {
    borderWidth: 1,
    borderRadius: 16,
    borderColor: colors2024['neutral-line'],
  },
  shadowView: {
    ...Platform.select({
      ios: {
        shadowColor: colors2024['neutral-black'],
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
}));

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disableShadow?: boolean;
}

export const AddressItemShadowView = (props: Props) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      style={StyleSheet.flatten([
        styles.viewBase,
        !props.disableShadow && styles.shadowView,
        props.style,
      ])}>
      {props.children}
    </View>
  );
};
