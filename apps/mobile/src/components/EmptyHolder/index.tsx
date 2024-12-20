import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  TextStyle,
  useColorScheme,
  View,
} from 'react-native';
import { Text } from '../Text';

const Icon = {
  default: {
    dark: require('@/assets/icons/assets/default-dark.png'),
    light: require('@/assets/icons/assets/default-white.png'),
  },
  card: {
    dark: require('@/assets/icons/assets/card-dark.png'),
    light: require('@/assets/icons/assets/card.png'),
  },
  list: {
    dark: require('@/assets/icons/assets/list-dark.png'),
    light: require('@/assets/icons/assets/list.png'),
  },
  protocol: {
    dark: require('@/assets/icons/assets/empty-protocol-dark.png'),
    light: require('@/assets/icons/assets/empty-protocol.png'),
  },
};

type Props = {
  text: string;
  type: 'protocol' | 'list' | 'card' | 'default';
  textStyle?: StyleProp<TextStyle>;
  imgStyle?: StyleProp<ImageStyle>;
};

export const EmptyHolder: React.FC<Props> = ({
  text,
  type,
  textStyle,
  imgStyle,
}) => {
  const theme = useColorScheme();
  const colors = useThemeColors();
  const emptySource = theme === 'light' ? Icon[type].light : Icon[type].dark;
  const styles = React.useMemo(() => getStyle(colors), [colors]);
  return (
    <View style={styles.container}>
      <Image style={imgStyle} source={emptySource} />
      <Text style={[styles.emptyListText, textStyle]}>{text}</Text>
    </View>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyListText: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-body'],
      fontWeight: '600',
    },
  });
