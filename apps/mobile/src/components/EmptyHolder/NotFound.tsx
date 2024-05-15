import {
  View,
  Text,
  StyleProp,
  TextStyle,
  StyleSheet,
  ColorValue,
} from 'react-native';

import { RcIconNotMatchedCC } from '@/assets/icons/common';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useMemo } from 'react';

export function NotFoundHolder({
  style,
  iconSize = 32,
  iconColor: propIconColor,
  textStyle,
  text = 'Not Found',
  colorVariant,
}: RNViewProps & {
  text?: string;
  iconSize?: number;
  iconColor?: ColorValue;
  textStyle?: StyleProp<TextStyle>;
  colorVariant?: 'body' | 'foot';
}) {
  const { colors, styles } = useThemeStyles(getNotMatchedHolderStyle);

  const { iconColor, textColor } = useMemo(() => {
    const res = (() => {
      switch (colorVariant) {
        default:
        case 'body':
          return {
            textColor: colors['neutral-body'] as ColorValue,
            iconColor: colors['neutral-body'] as ColorValue,
          };
        case 'foot':
          return {
            textColor: colors['neutral-foot'] as ColorValue,
            iconColor: colors['neutral-foot'] as ColorValue,
          };
      }
    })();

    if (propIconColor) {
      res.iconColor = propIconColor;
    }

    return res;
  }, [colorVariant, colors, propIconColor]);

  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
      <RcIconNotMatchedCC
        width={iconSize}
        height={iconSize}
        color={iconColor}
      />
      <Text
        style={StyleSheet.flatten([
          styles.emptyText,
          !textColor ? {} : { color: textColor },
          textStyle,
        ])}>
        {text}
      </Text>
    </View>
  );
}
const getNotMatchedHolderStyle = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      marginTop: 12,
      fontSize: 15,
      color: colors['neutral-body'],
      fontWeight: '600',
    },
  };
});
