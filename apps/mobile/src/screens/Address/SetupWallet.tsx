import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { PasswordForm } from '@/components2024/PasswordForm';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { useSetupWallet } from '@/hooks/address/useSetupWallet';
import {
  WalletSuccessCard,
  DEFAULT_ANIMATION_CONFIG,
} from '@/components2024/WalletSuccessCard';
import { useTheme2024 } from '@/hooks/theme';

type ScreenProps = NativeStackScreenProps<RootStackParamsList, 'SetupWallet'>;

const customEase = Easing.bezier(0.42, 0, 0.58, 1);

// Form animation starts after WalletSuccessCard finishes its address animation
const FORM_DELAY =
  DEFAULT_ANIMATION_CONFIG.INITIAL_DELAY +
  DEFAULT_ANIMATION_CONFIG.DURATION +
  DEFAULT_ANIMATION_CONFIG.DELAY_AFTER_TEXT +
  DEFAULT_ANIMATION_CONFIG.DURATION +
  350; // delay after address animation

export default function SetupWallet({ route }: ScreenProps) {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const { t } = useTranslation();

  const rawParams = route.params;
  const params =
    rawParams && 'seedPhraseVaultId' in rawParams
      ? { seedPhraseVaultId: rawParams.seedPhraseVaultId }
      : rawParams && 'privateKeyVaultId' in rawParams
      ? { privateKeyVaultId: rawParams.privateKeyVaultId }
      : undefined;

  const { address, isLoading, isSubmitting, handleSubmit, mode } =
    useSetupWallet(params);

  const isImportMode = mode !== 'create';
  const formProgress = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      formProgress.value = 0;
      formProgress.value = withDelay(
        FORM_DELAY,
        withTiming(1, {
          duration: DEFAULT_ANIMATION_CONFIG.DURATION,
          easing: customEase,
        }),
      );

      return () => {
        cancelAnimation(formProgress);
        formProgress.value = 1;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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
        {address && (
          <WalletSuccessCard
            title={t('page.newUserOnboarding.walletReady')}
            addresses={[
              {
                address,
                brandName: KEYRING_CLASS.MNEMONIC,
                showBalance: isImportMode,
              },
            ]}
          />
        )}

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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
  formContainer: {
    marginTop: 42,
    width: '100%',
    flexGrow: 1,
  },
}));
