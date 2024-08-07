import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { StyleSheet } from 'react-native';
import ShieldSVG from '@/assets/icons/address/shield-cc.svg';
import { createGetStyles } from '@/utils/styles';

interface Props {
  style?: StyleProp<ViewStyle>;
  isLight?: boolean;
  text?: string;
  logoSize?: number;
  textSize?: number;
  flexDirection?: 'row' | 'column';
  textGap?: number;
  masked?: boolean;
  onPress?: (masked: boolean) => void;
}

export const MaskContainer = ({
  style,
  masked,
  isLight,
  text,
  textSize = 15,
  logoSize = 20,
  flexDirection = 'row',
  textGap = 4,
  onPress,
}: Props) => {
  const { colors, styles } = useThemeStyles(getStyles, { isLight });
  const [innerMasked, setInnertMasked] = React.useState(true);

  const handlePress = React.useCallback(() => {
    setInnertMasked(false);
    onPress?.(false);
  }, [onPress]);

  React.useEffect(() => {
    setInnertMasked(masked ?? true);
  }, [masked]);

  if (!innerMasked) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={StyleSheet.flatten([
        styles.main,
        style,
        isLight && styles.mainIsLight,
        { flexDirection, gap: textGap },
      ])}>
      <ShieldSVG
        fontSize={15}
        width={logoSize}
        height={logoSize}
        color={isLight ? colors['neutral-body'] : colors['neutral-title-2']}
      />
      <Text
        style={StyleSheet.flatten([
          styles.text,
          isLight && styles.textIsLight,
          {
            fontSize: textSize,
          },
        ])}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles(colors =>
  StyleSheet.create({
    main: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors['neutral-black'],
      opacity: 0.95,
      zIndex: 1,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    mainIsLight: {
      backgroundColor: colors['neutral-card1'],
      opacity: 1,
    },
    text: {
      color: colors['neutral-title2'],
      fontSize: 15,
      textAlign: 'center',
    },
    textIsLight: {
      color: colors['neutral-body'],
    },
  }),
);
