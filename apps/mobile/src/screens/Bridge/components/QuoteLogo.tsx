import IconQuoteLoading from '@/assets/icons/swap/quote-loading.svg';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageStyle,
  StyleProp,
  View,
} from 'react-native';

export const QuoteLogo = ({
  isLoading,
  logo,
  bridgeLogo,
}: {
  isLoading?: boolean;
  logo: string;
  bridgeLogo: string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const imageStyle = useMemo(() => {
    const size = 24;
    return {
      width: size,
      height: size,
      borderRadius: 999999,
    };
  }, []);

  const bridgeImageStyle: StyleProp<ImageStyle> = useMemo(() => {
    const size = 14;
    return {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: size,
      height: size,
      borderRadius: 999999,
    };
  }, []);

  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.resetAnimation();
    }
  }, [isLoading, spinValue]);

  const source = useMemo(() => {
    if (typeof logo === 'string') {
      return { uri: logo };
    }
    return logo;
  }, [logo]);

  const bridgeSource = useMemo(() => {
    if (typeof bridgeLogo === 'string') {
      return { uri: bridgeLogo };
    }
    return bridgeLogo;
  }, [bridgeLogo]);

  return (
    <View style={styles.container}>
      <Image source={source} style={imageStyle} />
      {!!bridgeLogo && <Image source={bridgeSource} style={bridgeImageStyle} />}
      {isLoading && (
        <Animated.View
          style={[
            styles.loadingWrapper,
            {
              transform: [{ rotate: spin }],
            },
          ]}>
          <IconQuoteLoading width={33} height={33} />
        </Animated.View>
      )}
    </View>
  );
};

const getStyles = createGetStyles(_ => ({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
