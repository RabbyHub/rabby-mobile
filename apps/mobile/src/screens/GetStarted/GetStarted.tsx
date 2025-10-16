import React, { useCallback, useEffect, useState } from 'react';
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
import {
  navigateDeprecated,
  redirectToAddAddressEntry,
} from '@/utils/navigation';
import { Button } from '@rneui/themed';
import { useMemoizedFn, useRequest } from 'ahooks';
import axios from 'axios';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { APP_VERSIONS } from '@/constant';
import { useAppUnlocked } from '@/hooks/useLock';

function GetStartedScreen(): JSX.Element {
  const colors = useThemeColors();

  const styles = getStyles(colors);
  const [isShowModal, setIsShowModal] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [code, setCode] = useState('');
  const [errMessage, setErrMessage] = useState('');

  const { runAsync: invite, loading: isInviteLoading } = useRequest(
    (id: string) => {
      return axios.get<{ is_valid: boolean; code: number }>(
        'https://app-api.rabby.io/promotion/invitation',
        {
          params: {
            id,
          },
          headers: {
            'X-Client': 'rabbymobile',
            'X-Version': APP_VERSIONS.fromJs,
          },
        },
      );
    },
    {
      manual: true,
    },
  );

  const [isInited, setIsInited] = useState(false);
  const handleGetStarted = useCallback(async () => {
    if (!isInited) return;
    if (!keyringService.isUnlocked()) {
      navigateDeprecated(RootNames.Unlock);
      return;
    }

    redirectToAddAddressEntry();
    // if (preferenceService.getPreference('isInvited')) {
    //   navigateDeprecated(RootNames.StackAddress, { screen: RootNames.ImportNewAddress });
    // } else {
    //   setIsShowModal(true);
    // }
  }, [isInited]);

  const handleInvite = async () => {
    setErrMessage('');

    const INVALID_CODE = 'Invalid invitation code';
    const INVALID_VERSION = 'Invalid code, Please update to the latest version';

    if (!code?.trim()) {
      setErrMessage(INVALID_CODE);
      return;
    }
    try {
      const { data } = await invite(code?.trim());

      if (data?.is_valid) {
        preferenceService.setPreference({
          isInvited: true,
        });
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportNewAddress,
        });
        setIsShowModal(false);
      } else if (+data?.code === 2) {
        setErrMessage(INVALID_VERSION);
      } else {
        setErrMessage(INVALID_CODE);
      }
    } catch (e) {
      setErrMessage(INVALID_CODE);
    }
  };

  useEffect(() => {
    if (isShowModal) {
      setCode('');
      setErrMessage('');
    }
  }, [isShowModal]);

  const navigation = useNavigation();

  const initAccounts = useMemoizedFn(async () => {
    setIsInited(false);
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
      setIsInited(true);
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
            Your go-to wallet for Ethereum and EVM
          </Text>
        </View>
      </View>

      {/* button area */}
      <View style={styles.buttonArea}>
        <Button
          disabled={!isInited}
          buttonStyle={styles.buttonStyle}
          titleStyle={styles.buttonTitleStyle}
          title="Get Started"
          onPress={handleGetStarted}
        />
      </View>

      <Modal
        visible={isShowModal}
        className="w-[353] max-w-[100%]"
        onRequestClose={() => {
          setIsShowModal(false);
        }}
        transparent
        animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            setIsShowModal(false);
          }}>
          <View style={styles.overlay}>
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>
                Enter Invite Code to get started
              </Text>
              <TextInput
                style={[
                  styles.input,
                  isFocus ? styles.inputFocus : null,
                  errMessage ? styles.inputError : null,
                ]}
                onFocus={() => {
                  setIsFocus(true);
                }}
                onBlur={() => {
                  setIsFocus(false);
                }}
                onChangeText={v => {
                  setCode(v);
                }}
                value={code}
              />
              <View className="h-[16] mt-[10]">
                {errMessage ? (
                  <Text style={styles.errorMsg}>{errMessage}</Text>
                ) : null}
              </View>
              <View style={styles.modalFooter}>
                <View style={styles.flex1}>
                  <Button
                    title="Cancel"
                    buttonStyle={styles.cancelStyle}
                    titleStyle={styles.cancelTitleStyle}
                    onPress={() => {
                      setIsShowModal(false);
                    }}
                  />
                </View>
                <View style={styles.flex1}>
                  <Button
                    title="Next"
                    buttonStyle={styles.confirmStyle}
                    titleStyle={styles.confirmTitleStyle}
                    loading={isInviteLoading}
                    onPress={handleInvite}
                  />
                </View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
