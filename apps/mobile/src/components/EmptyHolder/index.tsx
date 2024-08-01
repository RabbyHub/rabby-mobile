import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import { Text } from '../Text';

const Icon = {
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
  type: 'protocol' | 'list' | 'card';
};

export const EmptyHolder: React.FC<Props> = ({ text, type }) => {
  const theme = useColorScheme();
  const colors = useThemeColors();
  const emptySource = theme === 'light' ? Icon[type].light : Icon[type].dark;
  const styles = React.useMemo(() => getStyle(colors), [colors]);
  return (
    <View style={styles.container}>
      <Image source={emptySource} />
      <Text style={styles.emptyListText}>{text}</Text>
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
