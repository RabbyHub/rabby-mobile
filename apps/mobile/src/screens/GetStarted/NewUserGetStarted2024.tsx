import React, { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import { RcIconLogoBlue } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { keyringService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { Button } from '@/components2024/Button';
import { useMemoizedFn } from 'ahooks';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppUnlocked } from '@/hooks/useLock';
import { createGetStyles2024 } from '@/utils/styles';
import TouchableText from '@/components/Touchable/TouchableText';
import { trigger } from 'react-native-haptic-feedback';
import {
  ProcDataType,
  useCreateAddressProc,
  useImportAddressProc,
} from '@/hooks/address/useNewUser';
import { isNonPublicProductionEnv } from '@/constant/env';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';

function GetStartedScreen2024(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [getStaretd, setGetStaretd] = useState<{
    localHasAccounts: boolean;
    processedInit: boolean;
  }>({
    localHasAccounts: false,
    processedInit: false,
  });

  const handleGoToHome = useCallback(async () => {
    if (!getStaretd.processedInit) return;
    if (!keyringService.isUnlocked()) {
      navigate(RootNames.Unlock);
      return;
    }

    navigate(RootNames.StackRoot, { screen: RootNames.Home });
  }, [getStaretd.processedInit]);

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
    if (!getStaretd.processedInit) return;
    if (!keyringService.isUnlocked()) {
      navigate(RootNames.Unlock);
      return;
    }

    startCreateAddressProc(ProcDataType.Seed, '');
    navigate(RootNames.StackAddress, {
      screen: RootNames.CreateNewAddress,
    });
  }, [getStaretd.processedInit, startCreateAddressProc]);

  const handleGoToImport = useCallback(async () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (!getStaretd.processedInit) return;
    if (!keyringService.isUnlocked()) {
      navigate(RootNames.Unlock);
      return;
    }

    navigate(RootNames.StackAddress, { screen: RootNames.ImportMethods });
  }, [getStaretd.processedInit]);

  const navigation = useRabbyAppNavigation();

  const initAccounts = useMemoizedFn(async () => {
    setGetStaretd(prev => ({ ...prev, processedInit: false }));
    try {
      const accounts = await keyringService.getAllVisibleAccountsArray();
      setGetStaretd(prev => ({ ...prev, localHasAccounts: !!accounts.length }));
      if (accounts?.length) {
        // navigation.dispatch(
        //   StackActions.replace(RootNames.StackRoot, {
        //     screen: RootNames.Home,
        //   }),
        // );
        resetNavigationTo(navigation, 'Home');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGetStaretd(prev => ({ ...prev, processedInit: true }));
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

  return (
    <View style={styles.screen}>
      <View style={styles.offsetArea} />
      <View style={styles.contentArea}>
        <View style={styles.centerWrapper}>
          {/* <RcIconLogo /> */}
          <View style={styles.logoWrapper}>
            <RcIconLogoBlue
              style={{ width: LOGO_SIZE.width, height: LOGO_SIZE.height }}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.appName}>Rabby Wallet</Text>

            {isNonPublicProductionEnv && (
              <View style={{ position: 'absolute', top: 2 }}>
                <TouchableText
                  style={[
                    styles.touchableText,
                    { color: colors2024['orange-default'] },
                  ]}
                  disabled={
                    !getStaretd.processedInit || getStaretd.localHasAccounts
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
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomArea}>
          <Text style={styles.appDesc}>
            The game-changing wallet
            {'\n'}
            for Ethereum and all EVM chains
          </Text>
          {!getStaretd.localHasAccounts ? (
            <>
              <Button
                type="primary"
                title={t('page.getStart.createNewAddress')}
                disabled={
                  !getStaretd.processedInit || getStaretd.localHasAccounts
                }
                onPress={handleGoToCreate}
              />
              <TouchableText
                style={styles.touchableText}
                disabled={
                  !getStaretd.processedInit || getStaretd.localHasAccounts
                }
                onPress={handleGoToImport}>
                {t('page.getStart.alreadyHaveAddress')}
              </TouchableText>
            </>
          ) : (
            <Button
              type="primary"
              title={t('page.getStart.goToHome')}
              disabled={
                !getStaretd.processedInit || !getStaretd.localHasAccounts
              }
              onPress={handleGoToHome}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const LOGO_SIZE = {
  wrapperWidth: 156,
  wrapperHeight: 156,
  width: 120,
  height: 104,
};

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    offsetArea: {
      flexShrink: 0,
      height:
        Math.floor(Dimensions.get('screen').height - LOGO_SIZE.wrapperHeight) /
        2,
    },
    contentArea: {
      flexShrink: 1,
      height: '100%',
      maxHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'space-between',
      paddingBottom: 84,
      // ...makeDebugBorder(),
    },
    centerWrapper: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // flex: 1,
      // leave here for debug
      // ...makeDebugBorder('yellow'),
    },
    logoWrapper: {
      width: LOGO_SIZE.wrapperWidth,
      // height: LOGO_SIZE.wrapperHeight,
      justifyContent: 'flex-start',
      alignItems: 'center',
      // leave here for debug
      // ...makeDebugBorder('red'),
    },
    titleContainer: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
    },
    appName: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.isLight
        ? ctx.colors2024['neutral-title-1']
        : ctx.colors2024['brand-default'],
      fontSize: 22.5,
      lineHeight: 28,
    },
    appDesc: {
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 24,
      textAlign: 'center',
      fontWeight: '500',
      marginTop: 32,
      marginBottom: 32,
    },
    modalTitle: {
      color: ctx.colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
      marginBottom: 20,
      textAlign: 'center',
    },
    modalFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 26,
      width: '100%',
      gap: 10,
    },
    flex1: {
      flex: 1,
    },
    bottomArea: {
      flexDirection: 'column',
      alignItems: 'center',
      // paddingBottom: 184,
      // ...makeDebugBorder(),
    },
    buttonContainerStyle: {
      width: 268,
      borderRadius: 56,
    },
    buttonStyle: {
      overflow: 'hidden',
    },
    buttonTitleStyle: {
      // __DEBUG_FONT_STYLE__: true,
      fontSize: 20,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors2024['neutral-InvertHighlight'],
    },

    touchableText: {
      marginTop: 22,
      fontSize: 17,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors2024['brand-default'],
    },
  }),
);

export default GetStartedScreen2024;
