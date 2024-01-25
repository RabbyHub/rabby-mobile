import RcIconFind from '@/assets/icons/dapp/icon-find.svg';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const SearchEmpty = ({ isDomain }: { isDomain?: boolean }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <RcIconFind />
      <View style={styles.content}>
        <Text style={styles.text}>No Dapp found</Text>
        {isDomain ? null : (
          <Text style={styles.text}>
            Please review your input or try searching the Dapp URL.
          </Text>
        )}
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
