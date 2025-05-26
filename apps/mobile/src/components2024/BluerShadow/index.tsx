import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';

const isAndroid = Platform.OS === 'android';

interface Props {
  children: React.ReactNode;
  blurAmount?: number;
  isLight?: boolean;
}

export const BlurShadowView = ({
  children,
  isLight,
  blurAmount = 29,
}: Props) => {
  if (!isLight || isAndroid) {
    return children;
  }
  return (
    <View style={styles.container}>
      <BlurView
        style={styles.blur}
        blurAmount={blurAmount}
        blurType="light"
        reducedTransparencyFallbackColor="white">
        {children}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(55, 56, 63)',
        shadowOffset: {
          width: 0,
          height: 18,
        },
        shadowOpacity: 0.04,
        shadowRadius: 29,
      },
    }),
  },
  blur: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
});
