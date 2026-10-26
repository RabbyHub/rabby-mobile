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

const LOGO_SLOT_SIZE = 32;
const MAIN_LOGO_SIZE = 24;
const BRIDGE_LOGO_SIZE = 14;
const BRIDGE_LOGO_OFFSET = 2;

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
    return {
      width: MAIN_LOGO_SIZE,
      height: MAIN_LOGO_SIZE,
      borderRadius: 999999,
    };
  }, []);

  const bridgeImageStyle: StyleProp<ImageStyle> = useMemo(() => {
    return {
      position: 'absolute',
      right: BRIDGE_LOGO_OFFSET,
      bottom: BRIDGE_LOGO_OFFSET,
      width: BRIDGE_LOGO_SIZE,
      height: BRIDGE_LOGO_SIZE,
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
          <IconQuoteLoading width={LOGO_SLOT_SIZE} height={LOGO_SLOT_SIZE} />
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
    width: LOGO_SLOT_SIZE,
    height: LOGO_SLOT_SIZE,
    flexShrink: 0,
  },
  loadingWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LOGO_SLOT_SIZE,
    height: LOGO_SLOT_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
