import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGetStyles2024 } from '@/utils/styles';
import Lottie from 'lottie-react-native';
import AnimationCreateSuccess from '@/assets2024/animations/animation-create-success.min.json';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { AddressCard } from '@/components2024/AddressCard';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { PasswordForm } from '@/components2024/PasswordForm';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { useSetupWallet } from '@/hooks/address/useSetupWallet';

type ScreenProps = NativeStackScreenProps<RootStackParamsList, 'SetupWallet'>;

// Custom cubic-bezier from Figma: [0.42, 0, 0.58, 1]
const customEase = Easing.bezier(0.42, 0, 0.58, 1);

// Animation timing configuration
const ANIMATION_CONFIG = {
  // Initial delay before any animation starts
  INITIAL_DELAY: 100,
  // Duration of each animation
  DURATION: 500,
  // Delay after text animation completes before address starts
  DELAY_AFTER_TEXT: 200,
  // Delay after address animation completes before form starts
  DELAY_AFTER_ADDRESS: 350,
} as const;

// Calculate actual start times based on sequential logic
const ANIMATION_START_TIMES = {
  // Text starts after initial delay
  TEXT: ANIMATION_CONFIG.INITIAL_DELAY,
  // Address starts after text completes + delay
  ADDRESS:
    ANIMATION_CONFIG.INITIAL_DELAY +
    ANIMATION_CONFIG.DURATION +
    ANIMATION_CONFIG.DELAY_AFTER_TEXT,
  // Form starts after address completes + delay
  FORM:
    ANIMATION_CONFIG.INITIAL_DELAY +
    ANIMATION_CONFIG.DURATION +
    ANIMATION_CONFIG.DELAY_AFTER_TEXT +
    ANIMATION_CONFIG.DURATION +
    ANIMATION_CONFIG.DELAY_AFTER_ADDRESS,
} as const;

export default function SetupWallet({ route }: ScreenProps) {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const { t } = useTranslation();

  // Convert route params to CreateWalletParams union type
  const rawParams = route.params;
  const params =
    rawParams && 'seedPhraseVaultId' in rawParams
      ? { seedPhraseVaultId: rawParams.seedPhraseVaultId }
      : rawParams && 'privateKeyVaultId' in rawParams
      ? { privateKeyVaultId: rawParams.privateKeyVaultId }
      : undefined;

  // Use the polymorphic hook for all wallet creation logic
  const { address, isLoading, isSubmitting, handleSubmit, mode } =
    useSetupWallet(params);

  // Determine if we're in import mode to show balance
  const isImportMode = mode !== 'create';

  // Animation values
  const textProgress = useSharedValue(0);
  const addressProgress = useSharedValue(0);
  const formProgress = useSharedValue(0);

  // Trigger animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log(
        '[SetupWallet] useFocusEffect triggered - starting animations',
      );

      // Reset values first
      textProgress.value = 0;
      addressProgress.value = 0;
      formProgress.value = 0;

      // Text: starts after initial delay
      textProgress.value = withDelay(
        ANIMATION_START_TIMES.TEXT,
        withTiming(1, {
          duration: ANIMATION_CONFIG.DURATION,
          easing: customEase,
        }),
      );

      // Address: starts after text completes + delay
      addressProgress.value = withDelay(
        ANIMATION_START_TIMES.ADDRESS,
        withTiming(1, {
          duration: ANIMATION_CONFIG.DURATION,
          easing: customEase,
        }),
      );

      // Form: starts after address completes + delay
      formProgress.value = withDelay(
        ANIMATION_START_TIMES.FORM,
        withTiming(1, {
          duration: ANIMATION_CONFIG.DURATION,
          easing: customEase,
        }),
      );

      // Cleanup: cancel animations when leaving screen
      return () => {
        cancelAnimation(textProgress);
        cancelAnimation(addressProgress);
        cancelAnimation(formProgress);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
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

  const formAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: formProgress.value,
      transform: [
        {
          translateY: interpolate(formProgress.value, [0, 1], [20, 0]),
        },
      ],
    };
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: top }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Lottie Animation - always visible */}
        <View style={styles.lottieContainer}>
          <Lottie
            source={AnimationCreateSuccess}
            style={styles.lottie}
            loop={false}
            autoPlay
          />
        </View>

        {/* Success Text - fades in */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={styles.successText}>
            {t('page.newUserOnboarding.walletReady')}
          </Text>
        </Animated.View>

        {/* Address Block - fades in + slides up after delay */}
        <Animated.View
          style={[
            styles.addressWrapper,
            styles.shadowContainer,
            addressAnimatedStyle,
          ]}>
          {address && (
            <AddressCard
              address={address}
              brandName={KEYRING_CLASS.MNEMONIC}
              showBalance={isImportMode}
            />
          )}
        </Animated.View>

        {/* Password Form - fades in + slides up after 350ms */}
        <Animated.View style={[styles.formContainer, formAnimatedStyle]}>
          <PasswordForm
            onSubmit={handleSubmit}
            topTip={t('page.newUserOnboarding.setPasswordTip')}
            loading={isSubmitting || isLoading}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    scrollContent: {
      alignItems: 'center',
      paddingHorizontal: 24,
      flexGrow: 1,
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
    successText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 26,
      color: colors2024['neutral-title-1'],
      textAlign: 'center',
    },
    addressWrapper: {
      marginTop: 24,
      width: '100%',
      minHeight: 70,
      borderRadius: 20,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    // Shadow styles - applied to same element as opacity animation
    shadowContainer: {
      // Shadow for iOS
      shadowColor: 'rgba(55, 56, 63)',
      shadowOffset: {
        width: 0,
        height: 20,
      },
      shadowOpacity: 0.06,
      shadowRadius: 43.3,
    },
    // Password form container - fills remaining space if available
    formContainer: {
      marginTop: 42,
      width: '100%',
      flexGrow: 1,
    },
  };
});
