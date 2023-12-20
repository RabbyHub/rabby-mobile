import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { Button } from '@rneui/themed';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

const EmptyItem = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.emptyCard, style]}>
      <View style={styles.circle} />
      <View style={styles.emptyCardContent}>
        <View style={styles.rect} />
        <View style={styles.rect1} />
      </View>
    </View>
  );
};

export const EmptyDapps = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Favorite</Text>
      <View style={styles.emptyList}>
        {[1, 0.8, 0.6, 0.4].map(opacity => {
          return (
            <EmptyItem
              style={{
                // todo css var
                backgroundColor: `rgba(255,255,255,${opacity})`,
                borderColor: `rgba(211, 216, 224, ${opacity})`,
              }}
              key={opacity}
            />
          );
        })}
      </View>
      <View style={styles.footer}>
        <Button
          buttonStyle={styles.buttonStyle}
          titleStyle={styles.buttonTitleStyle}
          title="Start with Favorite Popular Dapp"
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
      marginVertical: 8,
    },

    emptyList: {
      flexDirection: 'column',
      gap: 12,
    },

    emptyCard: {
      borderRadius: 7,
      backgroundColor: '#fff',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      borderStyle: 'solid',
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 15,
      paddingHorizontal: 14,
    },
    circle: {
      width: 27,
      height: 27,
      borderRadius: 14,
      flex: 0,
      backgroundColor: colors['neutral-card-2'],
    },
    emptyCardContent: {
      flex: 1,
      flexDirection: 'column',
      gap: 8,
    },
    rect: {
      width: 111,
      height: 17,
      backgroundColor: colors['neutral-card-2'],
    },
    rect1: {
      width: 77,
      height: 17,
      backgroundColor: colors['neutral-card-2'],
    },
    footer: {
      marginTop: 64,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonStyle: {
      width: 313,
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
