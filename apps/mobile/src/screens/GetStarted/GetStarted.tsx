import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconLogo } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { keyringService, preferenceService } from '@/core/services';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { Button } from '@rneui/themed';
import { useMemoizedFn, useRequest } from 'ahooks';
import axios from 'axios';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useAppLoaded } from '@/hooks/useLock';
import { BasicAuthenticationModal } from '@/components/AuthenticationModal/BasicAuthenticationModal';
import { useTranslation } from 'react-i18next';
import { toast, toastIndicator } from '@/components/Toast';
import { useAccounts } from '@/hooks/account';

function GetStartedScreen(): JSX.Element {
  const colors = useThemeColors();
  const { t } = useTranslation();

  const styles = getStyles(colors);

  const [getStartedInfo, setGsInfo] = useState({
    isInited: false,
    shouldUpgradeKeyringData: false,
  });

  const navigation = useNavigation();

  const { appHasUnencryptedKeyringData, fetchLoadInfo } = useAppLoaded();

  const redirectToHomeIfHasAccounts = useMemoizedFn(async () => {
    setGsInfo(prev => ({ ...prev, isInited: false }));
    fetchLoadInfo();
    try {
      const accounts = await keyringService.getAllVisibleAccountsArray();
      if (accounts?.length) {
        navigation.dispatch(
          StackActions.replace(RootNames.StackRoot, {
            screen: RootNames.Home,
          }),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGsInfo(prev => ({ ...prev, isInited: true }));
    }
  });

  const modalIdRef = useRef<string | null>(null);
  const unlockToGenerateUnencryptedKeyringData = useCallback(async () => {
    if (modalIdRef.current) return;

    let finished = false;
    const { modalId } = await BasicAuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('global.Cancel'),
      title: '[Upgrade] Use App at locked State',
      description:
        'App need to unlock to upgrade data to use new feature "Use App at locked State", This is just one demo text for preview, change it before production release',
      closableOnBackdropPress: false,
      authType: ['password'],
      validationHandler: async (password: string) => {
        const hideToast = toastIndicator('Upgrading', {
          duration: 6000,
          position: toast.positions.CENTER,
          hideOnPress: false,
        });
        try {
          await keyringService.generateUnencryptedKeyringDataIfNotExist(
            password,
          );
          finished = true;
        } catch (error) {
          console.error(error);
        } finally {
          modalIdRef.current = null;
          hideToast();
        }
      },
      onCancel: () => {
        modalIdRef.current = null;
      },
      onFinished(ctx) {
        redirectToHomeIfHasAccounts();

        if (ctx.hasSetupCustomPassword && !finished) {
          return;
        }
        modalIdRef.current = null;
      },
    });

    modalIdRef.current = modalId;
  }, [t, redirectToHomeIfHasAccounts]);

  const handleGetStarted = useCallback(async () => {
    if (!getStartedInfo.isInited) return;
    if (getStartedInfo.shouldUpgradeKeyringData) {
      await unlockToGenerateUnencryptedKeyringData();
      return;
    }
    // if (!keyringService.isLoaded()) {
    //   navigate(RootNames.Unlock);
    //   return;
    // }

    navigate(RootNames.StackAddress, { screen: RootNames.ImportNewAddress });
  }, [
    getStartedInfo.isInited,
    getStartedInfo.shouldUpgradeKeyringData,
    unlockToGenerateUnencryptedKeyringData,
  ]);

  useFocusEffect(
    useCallback(() => {
      const loadState = fetchLoadInfo();

      if (loadState.targetScreenType === 'Home') {
        redirectToHomeIfHasAccounts();
      }
    }, [fetchLoadInfo, redirectToHomeIfHasAccounts]),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.centerWrapper}>
        {/* top area */}
        <View style={styles.topArea}>
          <RcIconLogo />
          <View style={styles.titleContainer}>
            <View>
              <Text style={styles.appName}>Rabby Wallet</Text>
            </View>
            {Platform.OS !== 'ios' && (
              <View style={styles.beta}>
                <Text style={styles.betaText}>Beta</Text>
              </View>
            )}
          </View>

          <Text style={styles.appDesc}>
            The game-changing wallet
            {'\n'}
            for Ethereum and all EVM chains
          </Text>
        </View>
      </View>

      {/* button area */}
      <View style={styles.buttonArea}>
        {!appHasUnencryptedKeyringData ? (
          <Button
            disabled={appHasUnencryptedKeyringData}
            buttonStyle={styles.buttonStyle}
            titleStyle={styles.buttonTitleStyle}
            title="Upgrade Data Required"
            onPress={unlockToGenerateUnencryptedKeyringData}
          />
        ) : (
          <Button
            disabled={!getStartedInfo.isInited}
            buttonStyle={styles.buttonStyle}
            titleStyle={styles.buttonTitleStyle}
            title="Get Started"
            onPress={handleGetStarted}
          />
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors['blue-default'],
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    centerWrapper: {
      paddingHorizontal: 20,
      minHeight: '80%',
      height: 350 + 56 + 84,
      maxHeight: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      // // leave here for debug
      // borderWidth: 1,
      // borderColor: 'black',
    },
    topArea: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flex: 0,
    },
    titleContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: -14,
    },
    appName: {
      color: colors['neutral-title-2'],
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '500',
    },
    beta: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 90,
      paddingVertical: 2,
      paddingHorizontal: 8,
      color: 'white',
      fontSize: 12,
      fontWeight: '400',
      marginTop: 3,
      justifyContent: 'center',
      alignItems: 'center',
    },
    betaText: {
      display: 'flex',
      color: colors['neutral-title-2'],
      fontSize: 12,
      fontWeight: '400',
    },
    appDesc: {
      color: colors['neutral-title-2'],
      fontSize: 17,
      lineHeight: 24,
      textAlign: 'center',
      fontWeight: '500',
      marginTop: 32,
    },
    modalTitle: {
      color: colors['neutral-title-1'],
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
    errorMsg: {
      color: colors['red-default'],
      fontSize: 13,
      lineHeight: 16,
    },
    buttonArea: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: 80,
    },
    buttonStyle: {
      width: 268,
      height: 56,
      borderRadius: 8,
      backgroundColor: colors['neutral-title2'],
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.11,
          shadowRadius: 24,
        },
        android: {
          elevation: 24,
        },
      }),
    },
    buttonTitleStyle: {
      fontSize: 17,
      lineHeight: 20,
      fontWeight: '600',
      color: colors['blue-default'],
    },
    cancelStyle: {
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 6,
      height: 44,

      width: '100%',
    },
    cancelTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['blue-default'],
    },
    confirmStyle: {
      backgroundColor: colors['blue-default'],
      height: 44,
      borderRadius: 6,
      width: '100%',
    },
    confirmTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title2'],
    },
    touchable: {
      height: '100%',
      backgroundColor: colors['red-default'],
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.4)',
      height: '100%',
      justifyContent: 'center',
    },
    modalContent: {
      borderRadius: 8,
      backgroundColor: colors['neutral-bg1'],
      boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
      marginHorizontal: 20,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    input: {
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      borderStyle: 'solid',
      backgroundColor: colors['r-neutral-bg1'],
      height: 52,
      width: '100%',
      fontSize: 15,
      lineHeight: 18,
      padding: 15,
      borderRadius: 6,
    },
    inputFocus: {
      borderColor: colors['blue-default'],
    },
    inputError: {
      borderColor: colors['red-default'],
    },
  });

export default GetStartedScreen;
