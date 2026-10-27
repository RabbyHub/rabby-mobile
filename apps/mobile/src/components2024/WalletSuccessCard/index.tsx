import React from 'react';
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
import Lottie, { AnimationObject } from 'lottie-react-native';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressCard } from '../AddressCard';
import DefaultAnimation from '@/assets2024/animations/animation-create-success.min.json';

export const customEase = Easing.bezier(0.42, 0, 0.58, 1);

/** A double-mounted success screen must not replay the same entrance. */
const SUCCESS_ANIMATION_DEDUPE_MS = 10_000;
const recentlyAnimatedSuccessAt = new Map<string, number>();
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
  const animationKey = React.useMemo(
    () => `${title}|${addresses.map(item => item.address).join(',')}`,
    [addresses, title],
  );
  const shouldAnimateRef = React.useRef<boolean | null>(null);
  if (shouldAnimateRef.current === null) {
    const now = Date.now();
    const lastAnimatedAt = recentlyAnimatedSuccessAt.get(animationKey) || 0;
    const shouldAnimate =
      autoPlay && now - lastAnimatedAt > SUCCESS_ANIMATION_DEDUPE_MS;
    if (shouldAnimate) {
      recentlyAnimatedSuccessAt.set(animationKey, now);
    }
    shouldAnimateRef.current = shouldAnimate;
  }
  const shouldAnimate = shouldAnimateRef.current ?? false;
  const hasPlayedRef = React.useRef(false);
  /**
   * A unique, still frame-zero progress value per mounted card.
   *
   * On Fabric, iOS reuses native Lottie views between screens. A recycled view
   * can still show the previous run's settled (last) frame, and
   * lottie-react-native only forwards `progress` when the value actually
   * changes, so a plain `progress={0}` is skipped on the recycled instance and
   * that stale frame stays on screen until playback starts. Always sending a
   * different ~0 value forces `setProgress` to reset the native view to the
   * first frame before anything is painted, without depending on JS timing.
   */
  const frameZeroProgressRef = React.useRef(Math.random() * 1e-6);
  const lottieRef = React.useRef<Lottie>(null);
  const lottieStartedRef = React.useRef(false);
  const lottieEndFrame = React.useMemo(() => {
    if (
      lottieSource &&
      typeof lottieSource === 'object' &&
      typeof (lottieSource as AnimationObject).op === 'number'
    ) {
      return (lottieSource as AnimationObject).op;
    }
    return undefined;
  }, [lottieSource]);

  // The native player starts exactly once, from the first frame, on layout.
  // `autoPlay` is not used on purpose: lottie-react-native's iOS prop handling
  // starts playback by itself on recycled native views.
  const startLottie = React.useCallback(() => {
    if (!shouldAnimate || lottieStartedRef.current) {
      return;
    }
    const view = lottieRef.current;
    if (!view) {
      return;
    }
    lottieStartedRef.current = true;
    view.reset();
    if (lottieEndFrame != null) {
      view.play(0, lottieEndFrame);
    } else {
      view.play();
    }
  }, [lottieEndFrame, shouldAnimate]);

  // Follow-up imports already have a result to show on their first frame.
  const textProgress = useSharedValue(shouldAnimate ? 0 : 1);
  const addressProgress = useSharedValue(shouldAnimate ? 0 : 1);

  const TEXT_START = animationConfig.INITIAL_DELAY;
  const ADDRESS_START =
    animationConfig.INITIAL_DELAY +
    animationConfig.DURATION +
    animationConfig.DELAY_AFTER_TEXT;

  React.useEffect(() => {
    if (!shouldAnimate || hasPlayedRef.current) {
      return;
    }
    hasPlayedRef.current = true;

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
  }, [shouldAnimate]);

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
          ref={lottieRef}
          source={lottieSource}
          style={styles.lottie}
          loop={false}
          autoPlay={false}
          // A skipped animation must stay on its settled frame; speed 0 also
          // keeps lottie-react-native's iOS `setSpeed` from starting playback
          // while props are applied to a recycled native view.
          speed={shouldAnimate ? 1 : 0}
          progress={shouldAnimate ? frameZeroProgressRef.current : 1}
          onLayout={shouldAnimate ? startLottie : undefined}
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
    fontWeight: '900',
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
