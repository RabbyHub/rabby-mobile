import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RcIconLogoBlue } from '@/assets/icons/common';
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
import { trigger } from 'react-native-haptic-feedback';
import {
  ProcDataType,
  useCreateAddressProc,
  useImportAddressProc,
} from '@/hooks/address/useNewUser';
import { isNonPublicProductionEnv } from '@/constant';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';

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
    if (!getStaretd.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    navigateDeprecated(RootNames.StackRoot, { screen: RootNames.Home });
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
    if (!getStaretd.processedInit) {
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
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.CreateNewAddress,
      params: {
        isFirstCreate: true,
      },
    });
  }, [getStaretd.processedInit, startCreateAddressProc]);

  const handleGoToImport = useCallback(async () => {
    if (!getStaretd.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS,
    );
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.ImportMethods,
    });
  }, [getStaretd.processedInit]);

  const handleGoToSyncExtension = useCallback(async () => {
    if (!getStaretd.processedInit) {
      return;
    }
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);

      return;
    }

    navigateDeprecated(RootNames.Scanner, {
      syncExtension: true,
    });
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION,
    );
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

  const { bottom, top } = useSafeAreaInsets();
  const { height } = useSafeAreaFrame();

  const { height: WHeight } = useWindowDimensions();
  const offsetAreaStyle = useMemo(() => {
    const availableHeight = Math.min(height - bottom - top, WHeight);

    return {
      flexShrink: 0,
      height:
        availableHeight > 700
          ? Math.floor(availableHeight - LOGO_SIZE.wrapperHeight) / 2
          : 140,
    };
  }, [bottom, height, top, WHeight]);

  return (
    <View style={styles.screen}>
      <View style={offsetAreaStyle} />
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
              <View style={{ position: 'absolute', top: 36 }}>
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
            Your go-to wallet for Ethereum and EVM
          </Text>
          {!getStaretd.localHasAccounts ? (
            <View style={{ gap: 16 }}>
              <Button
                type="primary"
                title={t('page.getStart.createNewAddress')}
                disabled={
                  !getStaretd.processedInit || getStaretd.localHasAccounts
                }
                onPress={handleGoToCreate}
              />

              <Button
                disabled={
                  !getStaretd.processedInit || getStaretd.localHasAccounts
                }
                type="ghost"
                title={t('page.getStart.alreadyHaveAddress')}
                onPress={handleGoToImport}
              />
              <TouchableText
                style={styles.touchableText}
                disabled={
                  !getStaretd.processedInit || getStaretd.localHasAccounts
                }
                onPress={handleGoToSyncExtension}>
                {t('page.getStart.sync')}
              </TouchableText>
            </View>
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
  width: 89,
  height: 77,
};

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      // height: '100%',
      flex: 1,
    },

    contentArea: {
      flexShrink: 1,
      height: '100%',
      maxHeight: '100%',
      flexDirection: 'column',
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
      marginTop: 10,
      marginBottom: 64,
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
      marginTop: 56,
      fontSize: 16,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors2024['brand-default'],
      textAlign: 'center',

      //       color: var(---brand-default, #7084FF);
      // text-align: center;
      // font-family: "SF Pro Rounded";
      // font-size: 16px;
      // font-style: normal;
      // font-weight: 700;
      // line-height: 16.397px; /* 102.479% */
    },
  }),
);

export default GetStartedScreen2024;
