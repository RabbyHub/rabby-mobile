import RcDappEmpty from '@/assets/icons/dapp/dapp-empty.svg';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

export const EmptyDapps = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Favorites</Text>
      <View style={styles.card}>
        <View style={styles.image}>
          <Image
            style={{
              width: 262,
              height: 89,
            }}
            source={require('@/assets/icons/dapp/dapp-empty.png')}
          />
        </View>
        <Text style={styles.text}>
          No Favorite {Platform.OS === 'ios' ? 'Website' : 'Dapp'}
        </Text>
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      marginTop: 50,
    },
    title: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-foot'],
      marginBottom: 16,
    },

    card: {
      backgroundColor: colors['neutral-card1'],
      paddingHorizontal: 32,
      paddingTop: 18,
      paddingBottom: 18,
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      borderRadius: 6,

      flexDirection: 'column',
      alignItems: 'center',
    },

    image: {
      width: 262,
      maxWidth: '100%',
      marginBottom: 20,
    },

    text: {
      color: colors['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
    },
  });
