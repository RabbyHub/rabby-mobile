import IconQuoteLoading from '@/assets/icons/swap/quote-loading.svg';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

export const QuoteLogo = ({
  isLoading,
  logo,
  isCex = false,
  loaded = false,
  size = 24,
}: {
  isLoading?: boolean;
  logo: any;
  isCex?: boolean;
  loaded?: boolean;
  size?: number;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const imageStyle = useMemo(() => {
    const imageSize = !loaded && (isLoading || isCex) ? 18 : size;
    return {
      width: imageSize,
      height: imageSize,
      borderRadius: 999999,
    };
  }, [loaded, isLoading, isCex, size]);

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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image source={source} style={imageStyle} />
      {isLoading && (
        <Animated.View
          style={[
            styles.loadingWrapper,
            {
              transform: [{ rotate: spin }],
            },
          ]}>
          <IconQuoteLoading
            width={loaded ? size + 8 : 24}
            height={loaded ? size + 8 : 24}
          />
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
