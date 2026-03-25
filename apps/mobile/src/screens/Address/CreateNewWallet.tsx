import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';

import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGetStyles2024 } from '@/utils/styles';
import Lottie from 'lottie-react-native';
import AnimationCreateSuccess from '@/assets2024/animations/animation-create-success.json';
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
import { apiMnemonic, apisLock } from '@/core/apis';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { keyringService, preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import useAsync from 'react-use/lib/useAsync';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';
import {
  PasswordForm,
  PasswordFormValues,
} from '@/components2024/PasswordForm';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { useBiometrics } from '@/hooks/biometrics';
import { toast } from '@/components2024/Toast';

const DisMissKBWrapper = ({ children }: { children: React.ReactNode }) => (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    {children}
  </TouchableWithoutFeedback>
);

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

export default function CreateNewWalletScreen() {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    storeSeedPharse,
    storeAddressList,
    storePassword,
    resetCreateAddressProc,
  } = useCreateAddressProc();
  const { toggleBiometrics } = useBiometrics({ autoFetch: true });

  // Generate new address on mount
  const { value } = useAsync(async () => {
    // Generate seed phrase
    const generatedSeedPhrase = await apiMnemonic.generatePreMnemonic();

    // Create keyring and get first address
    const Keyring = keyringService.getKeyringClassForType(
      KEYRING_CLASS.MNEMONIC,
    ) as any;
    const keyring = new Keyring({
      mnemonic: generatedSeedPhrase,
      passphrase: '',
    });
    const accountsToCreate = keyring?.getAddresses(0, 1);

    const address = accountsToCreate?.[0].address;

    return {
      seedPhrase: generatedSeedPhrase,
      accountsToCreate,
      address,
      addressIndex: accountsToCreate?.[0].index,
    };
  }, []);

  // Animation values
  const textProgress = useSharedValue(0);
  const addressProgress = useSharedValue(0);
  const formProgress = useSharedValue(0);

  // Trigger animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log(
        '[CreateNewWallet] useFocusEffect triggered - starting animations',
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

  const handlePasswordSubmit = useCallback(
    async (formValues: PasswordFormValues) => {
      if (!value?.address || !value?.seedPhrase) return;

      setIsSubmitting(true);

      try {
        // Store password
        storePassword({
          password: formValues.password,
          confirmPassword: formValues.confirmPassword,
          enableBiometrics: formValues.enableBiometrics,
        });

        // Store address and seed phrase
        storeAddressList([
          {
            address: value.address,
            aliasName: '',
            index: value.addressIndex,
          },
        ]);
        storeSeedPharse(value.seedPhrase);

        // Update password
        const result = await apisLock.resetPasswordOnUI(formValues.password);
        if (result.error) {
          toast.show(result.error);
          return;
        }

        // Enable biometrics if selected
        try {
          await toggleBiometrics?.(formValues.enableBiometrics, {
            validatedPassword: formValues.password,
          });
        } catch (e) {
          console.log('toggleBiometrics error', e);
          toast.show('Enable biometrics failed');
        }

        // Add keyring and activate accounts
        await addKeyringAndactiveAndPersistAccounts(
          value.seedPhrase,
          '',
          value.accountsToCreate || [],
          true,
        );

        // Clean up temporary pre-mnemonic data
        keyringService.removePreMnemonics();

        // Report action
        preferenceService.setReportActionTs(
          REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
        );

        // Reset the temporary process state
        resetCreateAddressProc();

        // Navigate directly to Home
        apisSingleHome.navigateToSingleHome(
          {
            address: value.address,
            brandName: KEYRING_CLASS.MNEMONIC,
            type: KEYRING_TYPE.HdKeyring,
            index: value.addressIndex ?? 0,
          },
          { replace: true },
        );
        apisHomeTabIndex.setTabIndex(0);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      value,
      storeSeedPharse,
      storeAddressList,
      storePassword,
      toggleBiometrics,
      resetCreateAddressProc,
    ],
  );

  return (
    <DisMissKBWrapper>
      <View style={styles.container}>
        <View style={[styles.content, { marginTop: top }]}>
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
            <Text style={styles.successText}>Your wallet is ready 🚀</Text>
          </Animated.View>

          {/* Address Block - fades in + slides up after delay */}
          <Animated.View
            style={[
              styles.addressWrapper,
              styles.shadowContainer,
              addressAnimatedStyle,
            ]}>
            {value?.address && (
              <AddressCard
                address={value.address}
                brandName={KEYRING_CLASS.MNEMONIC}
              />
            )}
          </Animated.View>

          {/* Password Form - fades in + slides up after 350ms */}
          <Animated.View style={[styles.formContainer, formAnimatedStyle]}>
            <PasswordForm
              onSubmit={handlePasswordSubmit}
              topTip="Set a password to secure your wallet"
              loading={isSubmitting}
            />
          </Animated.View>
        </View>
      </View>
    </DisMissKBWrapper>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      flex: 1,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    lottieContainer: {
      marginBottom: -32,
    },
    lottie: {
      width: 180,
      height: 173,
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
      height: 70,
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
      // Shadow for Android
      elevation: 8,
    },
    // Password form container - fills remaining space
    formContainer: {
      marginTop: 42,
      width: '100%',
      flex: 1,
    },
  };
});
