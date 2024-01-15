import { Button, PrimaryButton } from '@/components/Button';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import RcIconFind from '@/assets/icons/dapp/icon-find.svg';

export const SearchEmpty = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <RcIconFind />
      <View style={styles.content}>
        <Text style={styles.text}>No Dapp found</Text>
        <Text style={styles.text}>
          Please check your search content or try to search the URL of the Dapp
        </Text>
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      paddingTop: 100,
      paddingBottom: 40,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: 12,
      gap: 8,
    },
    text: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
  });
