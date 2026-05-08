import React, { useCallback, useEffect, useState } from 'react';
import { View, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Lottie from 'lottie-react-native';

import { RootNames } from '@/constant/layout';
import { keyringService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { Button } from '@/components2024/Button';
import { useMemoizedFn } from 'ahooks';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppUnlocked } from '@/hooks/useLock';
import { createGetStyles2024 } from '@/utils/styles';
import TouchableText from '@/components/Touchable/TouchableText';
import {
  ProcDataType,
  useCreateAddressProc,
  useImportAddressProc,
} from '@/hooks/address/useNewUser';
import { isNonPublicProductionEnv } from '@/constant';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { Text } from '@/components/Typography';
import ChevronRightSmallCC from '@/assets/icons/common/chevron-right-small-cc.svg';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';

import StartScreenAnimation from '@/assets2024/animations/start-screen-animation.min.json';
import StartScreenAnimationDark from '@/assets2024/animations/start-screen-animation-dark.min.json';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Logo images
import logoLight from '@/assets/images/get-started/logo-light.png';
import logoDark from '@/assets/images/get-started/logo-dark.png';

// Lottie animation dimensions
const HERO_ASPECT_RATIO = 452 / 393;

// Hero illustration component using Lottie animation
const HeroIllustration = ({ isLight }: { isLight: boolean }) => {
  const { styles } = useTheme2024({ getStyle });

  const heroHeight = Math.ceil(SCREEN_WIDTH * HERO_ASPECT_RATIO);

  return (
    <View style={[styles.heroContainer, { height: heroHeight }]}>
      <Lottie
        source={isLight ? StartScreenAnimation : StartScreenAnimationDark}
        style={[styles.heroBackground, { height: heroHeight }]}
        loop={false}
        autoPlay
      />
    </View>
  );
};

function NewUserGetStartedScreen() {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();

  const [getStarted, setGetStarted] = useState<{
    localHasAccounts: boolean;
    processedInit: boolean;
  }>({
    localHasAccounts: false,
    processedInit: false,
  });

  const handleGoToHome = useCallback(async () => {
    if (!getStarted.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    navigateDeprecated(RootNames.StackRoot, { screen: RootNames.Home });
  }, [getStarted.processedInit]);

  const { startCreateAddressProc, resetCreateAddressProc } =
    useCreateAddressProc();
  const { resetImportAddressProc } = useImportAddressProc();

  useFocusEffect(
    useCallback(() => {
      resetCreateAddressProc();
      resetImportAddressProc();
    }, [resetCreateAddressProc, resetImportAddressProc]),
  );

  const handleGoToCreate = useCallback(async () => {
    if (!getStarted.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    startCreateAddressProc(ProcDataType.Seed, '');
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_CREATE_NEW_ADDRESS,
    );
    navigateDeprecated(RootNames.SetupWallet);
  }, [getStarted.processedInit, startCreateAddressProc]);

  const handleGoToImport = useCallback(async () => {
    if (!getStarted.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS,
    );
    navigateDeprecated(RootNames.SelectImportMethod);
  }, [getStarted.processedInit]);

  const handleGoToSyncExtension = useCallback(async () => {
    if (!getStarted.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    navigateDeprecated(RootNames.ImportRabbyWallet);
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION,
    );
  }, [getStarted.processedInit]);

  const initAccounts = useMemoizedFn(async () => {
    setGetStarted(prev => ({ ...prev, processedInit: false }));
    try {
      const accounts = await keyringService.getAllVisibleAccountsArray();
      setGetStarted(prev => ({ ...prev, localHasAccounts: !!accounts.length }));
      if (accounts?.length) {
        resetNavigationTo(navigation, 'Home');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGetStarted(prev => ({ ...prev, processedInit: true }));
    }
  });

  const { isAppUnlocked } = useAppUnlocked();
  useFocusEffect(
    useCallback(() => {
      if (isAppUnlocked) {
        initAccounts();
      }
    }, [isAppUnlocked, initAccounts]),
  );

  const { bottom, top } = useSafeAreaInsets();

  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.7, -0.4, 0.4, 1.4),
    });
  }, [logoOpacity]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const contentProgress = useSharedValue(1);

  useEffect(() => {
    contentProgress.value = 0;
    contentProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.7, -0.4, 0.4, 1.4),
    });
  }, [contentProgress]);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(contentProgress.value, [0, 1], [60, 0]),
      },
    ],
  }));

  return (
    <View style={styles.screen}>
      {/* Header with logo - positioned right next to status bar, horizontally centered */}
      <View style={[styles.logoWrapper, { top: top + 6 }]}>
        <Animated.Image
          source={isLight ? logoLight : logoDark}
          style={[styles.logoImage, logoAnimatedStyle]}
          resizeMode="contain"
        />
      </View>

      <View style={styles.contentContainer}>
        {/* Hero Illustration - crops from top on short screens */}
        <HeroIllustration isLight={isLight} />

        <Animated.View
          style={[contentAnimatedStyle, { flexShrink: 0, flexGrow: 1 }]}>
          {/* Text Content */}
          <View style={styles.textContent}>
            <Text style={styles.title}>{t('page.getStart.welcomeTitle')}</Text>
            <Text style={styles.subtitle}>{t('global.appDescription')}</Text>
          </View>

          {/* Spacer to push bottom actions to screen bottom */}
          <View style={styles.spacer} />

          {/* Bottom Actions */}
          <View
            style={[
              styles.bottomActions,
              { flexShrink: 0, paddingBottom: Math.max(bottom, 16) },
            ]}>
            {!getStarted.localHasAccounts ? (
              <>
                <TouchableOpacity
                  style={styles.syncLink}
                  disabled={
                    !getStarted.processedInit || getStarted.localHasAccounts
                  }
                  onPress={handleGoToSyncExtension}>
                  <View style={styles.syncLinkContent}>
                    <Text style={styles.syncLinkText}>
                      {t('page.getStart.alreadyUseRabby')}
                    </Text>
                    <ChevronRightSmallCC
                      color={colors2024['neutral-secondary']}
                    />
                  </View>
                </TouchableOpacity>
                <Button
                  type="primary"
                  title={t('page.getStart.createNewAddress')}
                  titleStyle={{ fontSize: 18 }}
                  disabled={
                    !getStarted.processedInit || getStarted.localHasAccounts
                  }
                  onPress={handleGoToCreate}
                />
                <Button
                  disabled={
                    !getStarted.processedInit || getStarted.localHasAccounts
                  }
                  type="ghost"
                  title={t('page.getStart.alreadyHaveAddress')}
                  titleStyle={{ fontSize: 18 }}
                  onPress={handleGoToImport}
                  buttonStyle={styles.secondaryButton}
                  {...makeTestIDProps(E2E_ID.onboarding.welcomeImportExisting)}
                />
              </>
            ) : (
              <Button
                type="primary"
                title={t('page.getStart.goToHome') || 'Go to Home'}
                titleStyle={{ fontSize: 18 }}
                disabled={
                  !getStarted.processedInit || !getStarted.localHasAccounts
                }
                onPress={handleGoToHome}
              />
            )}

            {isNonPublicProductionEnv && (
              <TouchableText
                style={[
                  styles.testLink,
                  { color: colors2024['orange-default'] },
                ]}
                disabled={
                  !getStarted.processedInit || getStarted.localHasAccounts
                }
                onPress={() => {
                  navigation.dispatch(
                    StackActions.push(RootNames.StackSettings, {
                      screen: RootNames.Settings,
                      params: {},
                    }),
                  );
                }}>
                {'(Test Only) Enter Settings >'}
              </TouchableText>
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(ctx => ({
  screen: {
    flex: 1,
    backgroundColor: ctx.colors['neutral-card1'],
  },
  logoWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  logoImage: {
    width: 178,
    height: 37,
  },
  contentContainer: {
    flex: 1,
  },
  heroContainer: {
    width: SCREEN_WIDTH,
    flexShrink: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginTop: -20,
  },
  heroBackground: {
    marginLeft: -12,
    width: SCREEN_WIDTH + 24,
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 36,
    textAlign: 'center',
    color: ctx.colors2024['neutral-title-1'],
    paddingTop: 10,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    color: ctx.colors2024['neutral-secondary'],
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: ctx.colors2024['brand-light-1'],
    borderWidth: 0,
  },
  syncLink: {
    marginBottom: 8,
  },
  syncLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  syncLinkText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  testLink: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
}));

export default NewUserGetStartedScreen;
