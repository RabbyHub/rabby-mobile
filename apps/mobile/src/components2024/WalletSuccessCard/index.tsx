import React, { useCallback } from 'react';
import { View, StyleProp, ViewStyle, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import Lottie, { AnimationObject } from 'lottie-react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressCard } from '../AddressCard';
import DefaultAnimation from '@/assets2024/animations/animation-create-success.min.json';

export const customEase = Easing.bezier(0.42, 0, 0.58, 1);

export const DEFAULT_ANIMATION_CONFIG = {
  INITIAL_DELAY: 100,
  DURATION: 500,
  DELAY_AFTER_TEXT: 200,
} as const;

export interface AddressItem {
  address: string;
  brandName: string;
  showBalance?: boolean;
}

export interface WalletSuccessCardProps {
  lottieSource?: string | AnimationObject | { uri: string };
  title: string;
  addresses: AddressItem[];
  style?: StyleProp<ViewStyle>;
  addressCardStyle?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  animationConfig?: typeof DEFAULT_ANIMATION_CONFIG;
}

export const WalletSuccessCard: React.FC<WalletSuccessCardProps> = ({
  lottieSource = DefaultAnimation,
  title,
  addresses,
  style,
  addressCardStyle,
  autoPlay = true,
  animationConfig = DEFAULT_ANIMATION_CONFIG,
}) => {
  const { styles } = useTheme2024({ getStyle });

  const textProgress = useSharedValue(0);
  const addressProgress = useSharedValue(0);

  const TEXT_START = animationConfig.INITIAL_DELAY;
  const ADDRESS_START =
    animationConfig.INITIAL_DELAY +
    animationConfig.DURATION +
    animationConfig.DELAY_AFTER_TEXT;

  useFocusEffect(
    useCallback(() => {
      if (!autoPlay) return;

      textProgress.value = 0;
      addressProgress.value = 0;

      textProgress.value = withDelay(
        TEXT_START,
        withTiming(1, {
          duration: animationConfig.DURATION,
          easing: customEase,
        }),
      );

      addressProgress.value = withDelay(
        ADDRESS_START,
        withTiming(1, {
          duration: animationConfig.DURATION,
          easing: customEase,
        }),
      );

      return () => {
        cancelAnimation(textProgress);
        cancelAnimation(addressProgress);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlay]),
  );

  const textAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: textProgress.value,
    };
  });

  const addressAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: addressProgress.value,
      transform: [
        {
          translateY: interpolate(addressProgress.value, [0, 1], [20, 0]),
        },
      ],
    };
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.lottieContainer}>
        <Lottie
          source={lottieSource}
          style={styles.lottie}
          loop={false}
          autoPlay
        />
      </View>

      <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
        <Text style={styles.titleText}>{title}</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.addressWrapper,
          styles.shadowContainer,
          addressAnimatedStyle,
        ]}>
        <ScrollView
          style={styles.addressScrollView}
          contentContainerStyle={styles.addressScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {addresses.map((item, index) => (
            <View
              key={item.address}
              style={index > 0 ? styles.addressGap : undefined}>
              <AddressCard
                address={item.address}
                brandName={item.brandName}
                showBalance={item.showBalance}
                style={addressCardStyle}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  lottieContainer: {
    width: 210,
    height: 190,
    marginBottom: -32,
    marginTop: -12,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
  },
  titleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  addressWrapper: {
    marginTop: 24,
    width: '100%',
    flex: 1,
  },
  addressScrollView: {
    width: '100%',
  },
  addressScrollContent: {
    flexGrow: 1,
  },
  addressGap: {
    marginTop: 12,
  },
  shadowContainer: {
    shadowColor: 'rgba(55, 56, 63)',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.06,
    shadowRadius: 43.3,
  },
}));

export default WalletSuccessCard;
