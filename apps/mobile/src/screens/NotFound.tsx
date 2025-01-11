import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Icon404 } from '@/assets/icons/404';
import { Text } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

export default function NotFoundScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Icon404 />
      <Text style={styles.title}>
        This page is temporarily unavailable {'\n'}in the app, please view it on
        PC
      </Text>
    </View>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      alignItems: 'center',
      paddingTop: '45%',
    },
    title: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: '600',
      color: colors['blue-light-1'],
      textAlign: 'center',
    },
    link: {
      marginTop: 15,
    },
    linkText: {
      fontSize: 14,
      color: colors['blue-default'],
    },
  });
