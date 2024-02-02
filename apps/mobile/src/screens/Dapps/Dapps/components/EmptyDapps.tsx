import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { Button } from '@rneui/themed';
import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

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
        <Text style={styles.text}>No Favorite Dapp</Text>
        <Button
          buttonStyle={styles.buttonStyle}
          titleStyle={styles.buttonTitleStyle}
          title="Explore Popular Dapps"
          onPress={() => {
            navigate(RootNames.StackFavoritePopularDapps);
          }}
        />
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {},
    title: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-foot'],
      marginBottom: 20,
      marginTop: 20,
    },

    card: {
      backgroundColor: colors['neutral-card1'],
      paddingHorizontal: 32,
      paddingTop: 50,
      paddingBottom: 36,
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      borderRadius: 6,

      flexDirection: 'column',
      alignItems: 'center',
    },

    image: {
      width: 262,
      maxWidth: '100%',
      marginBottom: 28,
    },

    text: {
      color: colors['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
      marginBottom: 57,
    },

    buttonStyle: {
      width: 289,
      maxWidth: '100%',
      height: 52,
      borderRadius: 6,
      backgroundColor: colors['blue-default'],
      boxShadow: '0px 8px 16px 0px rgba(112, 132, 255, 0.25)',
    },
    buttonTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title-2'],
    },
  });
